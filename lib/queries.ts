import { asc, desc, eq, gt } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import type { ProgramContext } from '@/lib/engine/attention'
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
 * Every program with all of its versions. The whole dataset is small by design
 * — the attention engine wants the full picture on each load, and at demo scale
 * fetching it outright beats any cleverness about partial loading.
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

export async function getRecords(): Promise<RecordRow[]> {
  const rows = await db.select().from(schema.records).orderBy(asc(schema.records.ref))
  return rows.map(toRecordLike)
}

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

/**
 * Item ids currently snoozed. Expired rows are simply not returned, so nothing
 * has to sweep the table for the queue to be correct.
 */
export async function getSnoozedItemIds(now = new Date()): Promise<Set<string>> {
  const rows = await db
    .select({ itemId: schema.snoozes.itemId })
    .from(schema.snoozes)
    .where(gt(schema.snoozes.until, now))
  return new Set(rows.map((r) => r.itemId))
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
 * Providers appearing under more than one program. The plan deliberately stops
 * short of real cross-program conflict detection; a shared-party flag is the
 * honest version of that at this stage, and it is the one that actually comes
 * up in the demo.
 */
export function sharedParties(
  programs: ProgramSummary[],
  records: RecordRow[],
): Map<string, string[]> {
  const byParty = new Map<string, Set<string>>()
  for (const r of records) {
    const program = programs.find((p) => p.id === r.programId)
    if (!program?.currentSpec) continue
    const key = program.currentSpec.fields.find((f) => f.type === 'text')?.key
    const value = key ? r.data[key] : null
    if (typeof value !== 'string' || !value) continue
    const set = byParty.get(value) ?? new Set<string>()
    set.add(r.programId)
    byParty.set(value, set)
  }
  const out = new Map<string, string[]>()
  for (const [party, ids] of byParty) {
    if (ids.size > 1) out.set(party, [...ids])
  }
  return out
}
