import { and, asc, eq, inArray, isNotNull, isNull, lt, lte, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import {
  attention,
  attentionForRecord,
  changeImpactFor,
  rankOf,
  type AttentionItem,
  type ProgramContext,
} from './attention'
import { nextWakeAt } from './wake'
import type { RecordLike } from './runtime'

/**
 * Keeping the materialised queue in step with the data.
 *
 * Everything here is plumbing around one rule: the only thing allowed to decide
 * what belongs in the queue is `attention()`. This module loads its inputs,
 * writes its outputs to a cache, and — in `verifyQueue` — runs it again to
 * prove the cache still matches. It never decides anything itself.
 *
 * Two triggers cover every way the answer can change:
 *
 *   a write     a record or a spec changed         → recompute that scope now
 *   a boundary  the calendar crossed UTC midnight  → recompute what the day moved
 *
 * There is no polling interval, because there is nothing to poll for: the
 * engine's dependence on `now` is quantised to UTC midnight, so between
 * midnights the queue can only change because somebody wrote something.
 */

export type WriteResult = { written: number; removed: number }

const EMPTY: WriteResult = { written: 0, removed: 0 }
const CHUNK = 250

function merge(...results: WriteResult[]): WriteResult {
  return results.reduce(
    (a, b) => ({ written: a.written + b.written, removed: a.removed + b.removed }),
    EMPTY,
  )
}

function toRecordLike(row: typeof schema.records.$inferSelect): RecordLike {
  return {
    id: row.id,
    ref: row.ref,
    programId: row.programId,
    specVersion: row.specVersion,
    state: row.state,
    data: row.data,
    stateEnteredAt: row.stateEnteredAt,
  }
}

async function loadContext(programId: string): Promise<ProgramContext | null> {
  const [programRows, versions] = await Promise.all([
    db.select().from(schema.programs).where(eq(schema.programs.id, programId)),
    db
      .select()
      .from(schema.programVersions)
      .where(eq(schema.programVersions.programId, programId))
      .orderBy(asc(schema.programVersions.version)),
  ])
  const program = programRows[0]
  const latest = versions[versions.length - 1]
  if (!program || !latest) return null
  return {
    programId: program.id,
    programName: program.name,
    currentVersion: latest.version,
    currentSpec: latest.spec,
    specByVersion: Object.fromEntries(versions.map((v) => [v.version, v.spec])),
  }
}

async function loadAllContexts(): Promise<ProgramContext[]> {
  const [programs, versions] = await Promise.all([
    db.select().from(schema.programs).orderBy(asc(schema.programs.createdAt)),
    db.select().from(schema.programVersions).orderBy(asc(schema.programVersions.version)),
  ])
  return programs.flatMap((p) => {
    const mine = versions.filter((v) => v.programId === p.id)
    const latest = mine[mine.length - 1]
    if (!latest) return []
    return [
      {
        programId: p.id,
        programName: p.name,
        currentVersion: latest.version,
        currentSpec: latest.spec,
        specByVersion: Object.fromEntries(mine.map((v) => [v.version, v.spec])),
      },
    ]
  })
}

function rowFor(item: AttentionItem, specVersion: number | null, stampedAt: Date) {
  return {
    id: item.id,
    programId: item.programId,
    recordId: item.recordId,
    urgency: item.urgency,
    ownerRole: item.ownerRole,
    rank: rankOf(item.urgency),
    sortKey: item.sortKey,
    item: item as unknown as Record<string, unknown>,
    specVersion,
    computedAt: stampedAt,
  }
}

/**
 * Upsert rather than delete-then-insert, so a page loading mid-recompute never
 * sees a gap where an item briefly does not exist. Stale rows are then whatever
 * this run did not stamp.
 */
async function upsertItems(rows: ReturnType<typeof rowFor>[]): Promise<number> {
  if (rows.length === 0) return 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(schema.attentionItems)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: schema.attentionItems.id,
        set: {
          programId: sql`excluded.program_id`,
          recordId: sql`excluded.record_id`,
          urgency: sql`excluded.urgency`,
          ownerRole: sql`excluded.owner_role`,
          rank: sql`excluded.rank`,
          sortKey: sql`excluded.sort_key`,
          item: sql`excluded.item`,
          specVersion: sql`excluded.spec_version`,
          computedAt: sql`excluded.computed_at`,
        },
      })
  }
  return rows.length
}

async function saveWakeups(
  ctx: ProgramContext,
  records: RecordLike[],
  now: Date,
): Promise<void> {
  const due: (typeof schema.recordWakeups.$inferInsert)[] = []
  const clear: string[] = []

  for (const record of records) {
    const at = nextWakeAt(
      record,
      [ctx.specByVersion[record.specVersion], ctx.currentSpec],
      now,
    )
    if (at) {
      due.push({
        recordId: record.id,
        programId: ctx.programId,
        wakeAt: at,
        reason: `clock boundary in ${record.state}`,
      })
    } else {
      clear.push(record.id)
    }
  }

  for (let i = 0; i < due.length; i += CHUNK) {
    await db
      .insert(schema.recordWakeups)
      .values(due.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: schema.recordWakeups.recordId,
        set: {
          programId: sql`excluded.program_id`,
          wakeAt: sql`excluded.wake_at`,
          reason: sql`excluded.reason`,
        },
      })
  }
  for (let i = 0; i < clear.length; i += CHUNK) {
    await db
      .delete(schema.recordWakeups)
      .where(inArray(schema.recordWakeups.recordId, clear.slice(i, i + CHUNK)))
  }
}

/**
 * Recompute the items belonging to specific records, and the wakeups that go
 * with them. Scoped deletion is by timestamp rather than by id list, so a
 * program with a thousand records does not build a thousand-parameter query.
 */
async function applyForRecords(
  ctx: ProgramContext,
  records: RecordLike[],
  now: Date,
  scope: 'record' | 'program',
): Promise<WriteResult> {
  const items = records.flatMap((r) => attentionForRecord(ctx, r, now))
  const stampedAt = new Date()
  const rows = items.map((item) => {
    const record = records.find((r) => r.id === item.recordId)
    return rowFor(item, record?.specVersion ?? null, stampedAt)
  })

  const written = await upsertItems(rows)
  await saveWakeups(ctx, records, now)

  const where =
    scope === 'program'
      ? and(
          eq(schema.attentionItems.programId, ctx.programId),
          isNotNull(schema.attentionItems.recordId),
          lt(schema.attentionItems.computedAt, stampedAt),
        )
      : and(
          inArray(
            schema.attentionItems.recordId,
            records.map((r) => r.id),
          ),
          lt(schema.attentionItems.computedAt, stampedAt),
        )

  const removed = await db.delete(schema.attentionItems).where(where).returning({
    id: schema.attentionItems.id,
  })
  return { written, removed: removed.length }
}

/**
 * Recompute a program's change-impact rows.
 *
 * Always run alongside a record recompute, because these rows depend on the
 * data and state of every record still pinned behind the current version — so
 * one record moving on can change what the group-level row says, or remove it.
 */
async function applyImpact(ctx: ProgramContext, now: Date): Promise<WriteResult> {
  const behindRows = await db
    .select()
    .from(schema.records)
    .where(
      and(
        eq(schema.records.programId, ctx.programId),
        lt(schema.records.specVersion, ctx.currentVersion),
      ),
    )
  const behind = behindRows.map(toRecordLike)
  const items = behind.length > 0 ? changeImpactFor(ctx, behind, now) : []

  const stampedAt = new Date()
  const written = await upsertItems(items.map((i) => rowFor(i, ctx.currentVersion, stampedAt)))

  const removed = await db
    .delete(schema.attentionItems)
    .where(
      and(
        eq(schema.attentionItems.programId, ctx.programId),
        isNull(schema.attentionItems.recordId),
        lt(schema.attentionItems.computedAt, stampedAt),
      ),
    )
    .returning({ id: schema.attentionItems.id })

  return { written, removed: removed.length }
}

/** Everything one record contributes, plus the program-level rows it can move. */
export async function recomputeForRecord(
  recordId: string,
  now = new Date(),
): Promise<WriteResult> {
  const [row] = await db.select().from(schema.records).where(eq(schema.records.id, recordId))
  if (!row) return EMPTY
  const ctx = await loadContext(row.programId)
  if (!ctx) return EMPTY

  const result = merge(
    await applyForRecords(ctx, [toRecordLike(row)], now, 'record'),
    await applyImpact(ctx, now),
  )
  await logRun('write', { programId: ctx.programId, recordsScanned: 1, ...result })
  return result
}

/** One program, whole. Used after an approval, a migration, or an import. */
export async function recomputeProgram(
  programId: string,
  now = new Date(),
  kind = 'program',
): Promise<WriteResult> {
  const started = Date.now()
  const ctx = await loadContext(programId)
  if (!ctx) return EMPTY

  const rows = await db
    .select()
    .from(schema.records)
    .where(eq(schema.records.programId, programId))
  const records = rows.map(toRecordLike)

  const result = merge(
    await applyForRecords(ctx, records, now, 'program'),
    await applyImpact(ctx, now),
  )
  await logRun(kind, {
    programId,
    recordsScanned: records.length,
    durationMs: Date.now() - started,
    ...result,
  })
  return result
}

/**
 * Every program. This is the midnight sweep: at the day boundary every open
 * item's day-count label moves at once, whatever its urgency does, so there is
 * nothing narrower to recompute.
 */
export async function recomputeAll(now = new Date()): Promise<WriteResult> {
  const contexts = await loadAllContexts()
  let out = EMPTY
  for (const ctx of contexts) {
    out = merge(out, await recomputeProgram(ctx.programId, now, 'sweep-program'))
  }
  await logRun('sweep', { ...out })
  return out
}

/**
 * Recompute only the records the calendar has reached.
 *
 * Cheap enough to run often, and a no-op on most runs, because every wakeup
 * lands on a UTC midnight. Its real value is as the hook for anything that
 * should happen when an item turns over without a person present — escalating a
 * breach, emailing whoever owns it — which is the thing a queue computed only
 * on page load cannot do at all.
 */
export async function processWakeups(now = new Date()): Promise<WriteResult & { woken: number }> {
  const started = Date.now()
  const due = await db
    .select()
    .from(schema.recordWakeups)
    .where(lte(schema.recordWakeups.wakeAt, now))

  if (due.length === 0) return { ...EMPTY, woken: 0 }

  const byProgram = new Map<string, string[]>()
  for (const row of due) {
    byProgram.set(row.programId, [...(byProgram.get(row.programId) ?? []), row.recordId])
  }

  let out = EMPTY
  for (const [programId, recordIds] of byProgram) {
    const ctx = await loadContext(programId)
    if (!ctx) continue
    const rows = await db
      .select()
      .from(schema.records)
      .where(inArray(schema.records.id, recordIds))
    out = merge(
      out,
      await applyForRecords(ctx, rows.map(toRecordLike), now, 'record'),
      await applyImpact(ctx, now),
    )
  }

  await logRun('wake', {
    recordsScanned: due.length,
    durationMs: Date.now() - started,
    ...out,
  })
  return { ...out, woken: due.length }
}

export type Verification = {
  fresh: number
  cached: number
  missing: string[]
  extra: string[]
  changed: string[]
  ok: boolean
}

/** Key order is not preserved through jsonb, so compare on a sorted shape. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v as object).sort(([a], [b]) => a.localeCompare(b)))
    }
    return v
  })
}

/**
 * Run the engine again and diff it against the cache.
 *
 * This is what keeps materialisation honest. The advantage of computing the
 * queue on every page load was never the freshness — it was that there existed
 * exactly one definition of what needs attention, so the queue could not be
 * quietly wrong. Caching normally destroys that. It does not here, as long as
 * the pure function survives as the arbiter and something actually asks it.
 */
export async function verifyQueue(now = new Date()): Promise<Verification> {
  const started = Date.now()
  const [contexts, recordRows, cachedRows] = await Promise.all([
    loadAllContexts(),
    db.select().from(schema.records),
    db.select().from(schema.attentionItems),
  ])

  const fresh = attention(contexts, recordRows.map(toRecordLike), now)
  const freshById = new Map(fresh.map((i) => [i.id, stable(JSON.parse(JSON.stringify(i)))]))
  const cachedById = new Map(cachedRows.map((r) => [r.id, stable(r.item)]))

  const missing = [...freshById.keys()].filter((id) => !cachedById.has(id))
  const extra = [...cachedById.keys()].filter((id) => !freshById.has(id))
  const changed = [...freshById.entries()]
    .filter(([id, body]) => cachedById.has(id) && cachedById.get(id) !== body)
    .map(([id]) => id)

  const result: Verification = {
    fresh: fresh.length,
    cached: cachedRows.length,
    missing,
    extra,
    changed,
    ok: missing.length === 0 && extra.length === 0 && changed.length === 0,
  }

  await logRun('verify', {
    recordsScanned: recordRows.length,
    mismatches: missing.length + extra.length + changed.length,
    durationMs: Date.now() - started,
    detail: {
      missing: missing.slice(0, 20),
      extra: extra.slice(0, 20),
      changed: changed.slice(0, 20),
    },
  })
  return result
}

async function logRun(
  kind: string,
  fields: {
    programId?: string
    recordsScanned?: number
    written?: number
    removed?: number
    mismatches?: number
    durationMs?: number
    detail?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await db.insert(schema.queueRuns).values({
      kind,
      programId: fields.programId ?? null,
      recordsScanned: fields.recordsScanned ?? 0,
      itemsWritten: fields.written ?? 0,
      itemsRemoved: fields.removed ?? 0,
      mismatches: fields.mismatches ?? 0,
      durationMs: fields.durationMs ?? 0,
      detail: fields.detail ?? {},
    })
  } catch (error) {
    // Observability is not worth failing a write over.
    console.warn('[queue] run log failed:', error instanceof Error ? error.message : error)
  }
}
