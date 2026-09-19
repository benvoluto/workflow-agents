import { and, asc, count, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import type { AttentionItem, ProgramContext, Urgency } from '@/lib/engine/attention'
import { URGENCY_ORDER } from '@/lib/engine/attention'
import type { Role } from '@/lib/spec/types'
import type { RecordLike } from '@/lib/engine/runtime'
import type { Spec } from '@/lib/spec/types'

export type ProgramSummary = {
  id: string
  name: string
  entity: string
  currentVersion: number
  currentSpec: Spec
  versions: { version: number; spec: Spec; approvedBy: string | null; summary: string | null; createdAt: Date; sourceDocumentId: string | null }[]
}

/**
 * Every program with all of its versions.
 *
 * Still fetched whole, and still cheap: programs are counted in tens and
 * versions in tens per program, however many records they govern. Provenance
 * needs the full history to answer which version last changed an element, so
 * there is nothing to page here.
 */
export async function getPrograms(): Promise<ProgramSummary[]> {
  const [programs, versions] = await Promise.all([
    db.select().from(schema.programs).orderBy(asc(schema.programs.createdAt)),
    db
      .select()
      .from(schema.programVersions)
      .orderBy(asc(schema.programVersions.version)),
  ])

  return programs.map((p) => {
    const mine = versions.filter((v) => v.programId === p.id)
    const latest = mine[mine.length - 1]
    return {
      id: p.id,
      name: p.name,
      entity: p.entity,
      currentVersion: latest?.version ?? 0,
      currentSpec: latest?.spec as Spec,
      versions: mine.map((v) => ({
        version: v.version,
        spec: v.spec,
        approvedBy: v.approvedBy,
        summary: v.summary,
        createdAt: v.createdAt,
        sourceDocumentId: v.sourceDocumentId,
      })),
    }
  })
}

export function toContexts(programs: ProgramSummary[]): ProgramContext[] {
  return programs
    .filter((p) => p.currentSpec)
    .map((p) => ({
      programId: p.id,
      programName: p.name,
      currentVersion: p.currentVersion,
      currentSpec: p.currentSpec,
      specByVersion: Object.fromEntries(p.versions.map((v) => [v.version, v.spec])),
    }))
}

export type RecordRow = RecordLike & { updatedAt: Date; createdAt: Date }

export async function getRecord(id: string): Promise<RecordRow | null> {
  const [row] = await db.select().from(schema.records).where(eq(schema.records.id, id))
  return row ? toRecordLike(row) : null
}

function toRecordLike(row: typeof schema.records.$inferSelect): RecordRow {
  return {
    id: row.id,
    ref: row.ref,
    programId: row.programId,
    specVersion: row.specVersion,
    state: row.state,
    data: row.data,
    stateEnteredAt: row.stateEnteredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function getEvents(recordId: string) {
  return db
    .select()
    .from(schema.events)
    .where(eq(schema.events.recordId, recordId))
    .orderBy(desc(schema.events.at))
}

export async function getPendingDeltas() {
  return db
    .select()
    .from(schema.deltas)
    .where(eq(schema.deltas.status, 'pending'))
    .orderBy(desc(schema.deltas.createdAt))
}

export async function getDelta(id: string) {
  const [row] = await db.select().from(schema.deltas).where(eq(schema.deltas.id, id))
  return row ?? null
}

export async function getDocument(id: string) {
  const [row] = await db.select().from(schema.documents).where(eq(schema.documents.id, id))
  return row ?? null
}


/**
 * Reading the materialised queue.
 *
 * The engine still defines every row in `attention_items`; these functions only
 * choose which of them a given person sees right now. Two filters stay here in
 * the read path rather than in the cache, because both are per-viewer and
 * neither is worth a recomputation:
 *
 *   role    a Program Officer sees the whole queue, Finance and the CFO only
 *           what is theirs — one cache, three views
 *   snooze  hides a row for one person for a few days without touching the
 *           condition underneath, which keeps running
 */

/** jsonb gives back `dueAt` as a string; the UI wants the Date the engine made. */
function toAttentionItem(row: { item: Record<string, unknown> }): AttentionItem {
  const item = row.item as unknown as AttentionItem & { dueAt: string | null }
  return { ...item, dueAt: item.dueAt ? new Date(item.dueAt) : null }
}

/** Rows this role may see, minus anything currently snoozed. */
function visibleWhere(role: Role) {
  const notSnoozed = sql`not exists (
    select 1 from ${schema.snoozes}
    where ${schema.snoozes.itemId} = ${schema.attentionItems.id}
      and ${schema.snoozes.until} > now()
  )`
  if (role === 'program_officer') return notSnoozed
  return and(
    notSnoozed,
    sql`(${schema.attentionItems.ownerRole} is null or ${schema.attentionItems.ownerRole} = ${role})`,
  )
}

export async function getQueue(options: {
  role: Role
  urgency?: string | null
  programId?: string
  recordId?: string
  limit?: number
}): Promise<AttentionItem[]> {
  const filters = [visibleWhere(options.role)]
  if (options.urgency) filters.push(eq(schema.attentionItems.urgency, options.urgency))
  if (options.programId) filters.push(eq(schema.attentionItems.programId, options.programId))
  if (options.recordId) filters.push(eq(schema.attentionItems.recordId, options.recordId))

  const rows = await db
    .select({ item: schema.attentionItems.item })
    .from(schema.attentionItems)
    .where(and(...filters))
    .orderBy(asc(schema.attentionItems.rank), asc(schema.attentionItems.sortKey))
    .limit(options.limit ?? 200)

  return rows.map(toAttentionItem)
}

export type QueueCounts = {
  byUrgency: Record<Urgency, number>
  total: number
  snoozed: number
}

/**
 * Counts for the filter tabs, as aggregates rather than by fetching the queue
 * and measuring it. This is the read that stops mattering how many grants are
 * in flight.
 */
export async function getQueueCounts(role: Role): Promise<QueueCounts> {
  const [live, snoozedRows] = await Promise.all([
    db
      .select({ urgency: schema.attentionItems.urgency, n: count() })
      .from(schema.attentionItems)
      .where(visibleWhere(role))
      .groupBy(schema.attentionItems.urgency),
    db
      .select({ n: count() })
      .from(schema.attentionItems)
      .where(
        and(
          role === 'program_officer'
            ? undefined
            : sql`(${schema.attentionItems.ownerRole} is null or ${schema.attentionItems.ownerRole} = ${role})`,
          sql`exists (
            select 1 from ${schema.snoozes}
            where ${schema.snoozes.itemId} = ${schema.attentionItems.id}
              and ${schema.snoozes.until} > now()
          )`,
        ),
      ),
  ])

  const byUrgency = Object.fromEntries(URGENCY_ORDER.map((u) => [u, 0])) as Record<
    Urgency,
    number
  >
  let total = 0
  for (const row of live) {
    if (row.urgency in byUrgency) byUrgency[row.urgency as Urgency] = row.n
    total += row.n
  }
  return { byUrgency, total, snoozed: snoozedRows[0]?.n ?? 0 }
}

/**
 * Which records have anything against them at all, for the dot on a grant row
 * and the flag on a funnel stage. Role-independent on purpose: the mark means
 * "this needs somebody", not "this needs you".
 */
export async function getFlaggedRecordIds(programId?: string): Promise<Set<string>> {
  const filters = [isNotNull(schema.attentionItems.recordId)]
  if (programId) filters.push(eq(schema.attentionItems.programId, programId))
  const rows = await db
    .selectDistinct({ recordId: schema.attentionItems.recordId })
    .from(schema.attentionItems)
    .where(and(...filters))
  return new Set(rows.map((r) => r.recordId).filter(Boolean) as string[])
}

/** How many records sit in each state, per program. The funnel, without the rows. */
export async function getStateCounts(): Promise<Map<string, Map<string, number>>> {
  const rows = await db
    .select({
      programId: schema.records.programId,
      state: schema.records.state,
      n: count(),
    })
    .from(schema.records)
    .groupBy(schema.records.programId, schema.records.state)

  const out = new Map<string, Map<string, number>>()
  for (const row of rows) {
    const inner = out.get(row.programId) ?? new Map<string, number>()
    inner.set(row.state, row.n)
    out.set(row.programId, inner)
  }
  return out
}

/** How many records sit on each spec version, per program. */
export async function getVersionCounts(): Promise<Map<string, Map<number, number>>> {
  const rows = await db
    .select({
      programId: schema.records.programId,
      specVersion: schema.records.specVersion,
      n: count(),
    })
    .from(schema.records)
    .groupBy(schema.records.programId, schema.records.specVersion)

  const out = new Map<string, Map<number, number>>()
  for (const row of rows) {
    const inner = out.get(row.programId) ?? new Map<number, number>()
    inner.set(row.specVersion, row.n)
    out.set(row.programId, inner)
  }
  return out
}

/** How many of a program's records are pinned behind its current version. */
export function behindCount(
  versions: Map<number, number> | undefined,
  currentVersion: number,
): number {
  if (!versions) return 0
  let total = 0
  for (const [version, n] of versions) if (version < currentVersion) total += n
  return total
}

/** The most recently touched records of one program. */
export async function getRecentRecords(
  programId: string,
  limit = 5,
): Promise<RecordRow[]> {
  const rows = await db
    .select()
    .from(schema.records)
    .where(eq(schema.records.programId, programId))
    .orderBy(desc(schema.records.updatedAt))
    .limit(limit)
  return rows.map(toRecordLike)
}

/**
 * A page of records, newest movement first.
 *
 * `flaggedOnly` is an EXISTS against the materialised queue rather than an id
 * list, so "show me everything that needs somebody" stays one query whatever
 * the answer's size.
 */
export async function getRecordPage(options: {
  programId?: string
  state?: string
  ids?: string[]
  flaggedOnly?: boolean
  limit?: number
  offset?: number
}): Promise<RecordRow[]> {
  const filters = []
  if (options.programId) filters.push(eq(schema.records.programId, options.programId))
  if (options.state) filters.push(eq(schema.records.state, options.state))
  if (options.ids) {
    if (options.ids.length === 0) return []
    filters.push(inArray(schema.records.id, options.ids))
  }
  if (options.flaggedOnly) {
    filters.push(sql`exists (
      select 1 from ${schema.attentionItems}
      where ${schema.attentionItems.recordId} = ${schema.records.id}
    )`)
  }

  const rows = await db
    .select()
    .from(schema.records)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.records.updatedAt))
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0)
  return rows.map(toRecordLike)
}

export async function countRecords(programId?: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(schema.records)
    .where(programId ? eq(schema.records.programId, programId) : undefined)
  return rows[0]?.n ?? 0
}

/** The last few recomputations, for the health panel on the program page. */
export async function getQueueRuns(limit = 5) {
  return db
    .select()
    .from(schema.queueRuns)
    .orderBy(desc(schema.queueRuns.at))
    .limit(limit)
}

/**
 * The states that currently hold at least one flagged record, per program.
 *
 * The funnel marks a stage when something sitting in it needs somebody. That is
 * a join rather than a scan, so it stays one query whether a program is running
 * twelve grants or twelve thousand.
 */
export async function getFlaggedStates(): Promise<Map<string, Set<string>>> {
  const rows = await db
    .selectDistinct({
      programId: schema.records.programId,
      state: schema.records.state,
    })
    .from(schema.attentionItems)
    .innerJoin(schema.records, eq(schema.attentionItems.recordId, schema.records.id))

  const out = new Map<string, Set<string>>()
  for (const row of rows) {
    const set = out.get(row.programId) ?? new Set<string>()
    set.add(row.state)
    out.set(row.programId, set)
  }
  return out
}

/** The cached items belonging to a specific set of records, for a table of flags. */
export async function getItemsForRecords(
  recordIds: string[],
): Promise<Map<string, AttentionItem[]>> {
  if (recordIds.length === 0) return new Map()
  const rows = await db
    .select({ recordId: schema.attentionItems.recordId, item: schema.attentionItems.item })
    .from(schema.attentionItems)
    .where(inArray(schema.attentionItems.recordId, recordIds))
    .orderBy(asc(schema.attentionItems.rank), asc(schema.attentionItems.sortKey))

  const out = new Map<string, AttentionItem[]>()
  for (const row of rows) {
    if (!row.recordId) continue
    out.set(row.recordId, [...(out.get(row.recordId) ?? []), toAttentionItem(row)])
  }
  return out
}

/**
 * Which parties appear under more than one program.
 *
 * The plan deliberately stops short of real cross-program conflict detection; a
 * shared-party flag is the honest version of that at this stage.
 *
 * Built from a `select distinct` on the one jsonb key each program uses for its
 * party name, rather than by loading every record and grouping in memory. The
 * key differs per program because it comes from that program's spec, which is
 * why this is one query per program rather than one query overall.
 */
export async function getPartyIndex(
  programs: ProgramSummary[],
): Promise<Map<string, string[]>> {
  const byParty = new Map<string, Set<string>>()

  for (const program of programs) {
    const key = program.currentSpec?.fields.find((f) => f.type === 'text')?.key
    if (!key) continue
    const rows = await db
      .selectDistinct({ party: sql<string | null>`${schema.records.data} ->> ${key}` })
      .from(schema.records)
      .where(eq(schema.records.programId, program.id))

    for (const row of rows) {
      if (!row.party) continue
      const set = byParty.get(row.party) ?? new Set<string>()
      set.add(program.id)
      byParty.set(row.party, set)
    }
  }

  const out = new Map<string, string[]>()
  for (const [party, ids] of byParty) if (ids.size > 1) out.set(party, [...ids])
  return out
}

/**
 * Every record of one program.
 *
 * The exception to reading in pages, and a deliberate one: the review screen
 * answers "how many in-flight grants would this change affect", and a count
 * that is only approximately right is worse than no count at all when somebody
 * is deciding whether to approve it.
 */
export async function getProgramRecords(programId: string): Promise<RecordRow[]> {
  const rows = await db
    .select()
    .from(schema.records)
    .where(eq(schema.records.programId, programId))
    .orderBy(asc(schema.records.ref))
  return rows.map(toRecordLike)
}
