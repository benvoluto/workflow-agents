import { asc, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { coerceValue, inferSpecFromTable, parseCsv } from './extract'
import type { Spec } from '@/lib/spec/types'

/**
 * Turning a spreadsheet into a program and its records.
 *
 * Kept out of the server actions so the whole path can be exercised directly:
 * an action ends in a redirect, which makes it unusable from a script, and this
 * is the step most worth being able to run for real before a demo.
 */

async function currentSpecOf(
  programId: string,
): Promise<{ spec: Spec; version: number } | null> {
  const rows = await db
    .select()
    .from(schema.programVersions)
    .where(eq(schema.programVersions.programId, programId))
    .orderBy(asc(schema.programVersions.version))
  const latest = rows[rows.length - 1]
  return latest ? { spec: latest.spec, version: latest.version } : null
}

async function refPrefixFor(programId: string, entity: string): Promise<string> {
  const [existing] = await db
    .select({ ref: schema.records.ref })
    .from(schema.records)
    .where(eq(schema.records.programId, programId))
    .orderBy(asc(schema.records.ref))
    .limit(1)
  if (existing?.ref?.includes('-')) return existing.ref.split('-')[0]
  return entity.slice(0, 3).toUpperCase() || 'REC'
}

async function nextRefNumber(programId: string): Promise<number> {
  const rows = await db
    .select({ ref: schema.records.ref })
    .from(schema.records)
    .where(eq(schema.records.programId, programId))
  const numbers = rows
    .map((r) => Number(r.ref.split('-')[1]))
    .filter((n) => Number.isFinite(n))
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1001
}

export { currentSpecOf }

export async function createProgramFromTable(name: string, bodyText: string): Promise<string> {
  const { spec } = await inferSpecFromTable({ fileName: name, tableText: bodyText })
  const [program] = await db
    .insert(schema.programs)
    .values({ name: spec.name, entity: spec.entity })
    .returning()

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.name, name))
    .orderBy(sql`uploaded_at desc`)
    .limit(1)

  await db.insert(schema.programVersions).values({
    programId: program.id,
    version: 1,
    spec,
    sourceDocumentId: doc?.id ?? null,
    approvedBy: null,
    summary: `Created from ${name} — fields and a placeholder lifecycle.`,
  })
  return program.id
}

/**
 * Map spreadsheet columns onto the program's fields and create a record per row.
 *
 * Matching is by key first, then by label, both case- and separator-insensitive,
 * because the column that produced a field is rarely spelled the way the field
 * ended up being named.
 */
export async function importRows(programId: string, csvText: string) {
  const current = await currentSpecOf(programId)
  if (!current) return
  const { spec, version } = current
  const { headers, rows } = parseCsv(csvText)
  if (rows.length === 0) return

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const columnToField = headers.map((h) => {
    const n = norm(h)
    return (
      spec.fields.find((f) => norm(f.key) === n) ??
      spec.fields.find((f) => norm(f.label) === n) ??
      null
    )
  })

  const prefix = await refPrefixFor(programId, spec.entity)
  let next = await nextRefNumber(programId)

  for (const row of rows) {
    const data: Record<string, unknown> = {}
    row.forEach((cell, i) => {
      const field = columnToField[i]
      if (field) data[field.key] = coerceValue(cell, field.type)
    })
    if (Object.keys(data).length === 0) continue

    const [record] = await db
      .insert(schema.records)
      .values({
        ref: `${prefix}-${next++}`,
        programId,
        specVersion: version,
        state: spec.initial || spec.states[0] || 'new',
        data,
      })
      .returning()

    await db.insert(schema.events).values({
      recordId: record.id,
      type: 'created',
      actor: 'System',
      payload: { source: 'spreadsheet import' },
    })
  }
}

