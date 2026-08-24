'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { availableTransitions, validateTransition, type RecordLike } from '@/lib/engine/runtime'
import { applyOps, type DeltaOp } from '@/lib/spec/delta'
import { coerceValue, extractDelta } from '@/lib/ingest/extract'
import { createProgramFromTable, currentSpecOf, importRows } from '@/lib/ingest/import'
import { actorFor, currentRole, ROLE_COOKIE, ROLES, type Role } from '@/lib/roles'
import { archiveDocument } from '@/lib/storage/blob'
import type { Spec } from '@/lib/spec/types'
import { emptySpec, titleFromDocument } from '@/lib/spec/starter'
import { SAMPLES } from '@/lib/samples.generated'

/**
 * Stop showing one queue item for a few days.
 *
 * Snoozing hides the item, never the underlying condition: the clock keeps
 * running, the rule stays unmet, and the item comes back on its own. It is a
 * way to say "not today", not a way to close something.
 */
export async function snoozeItem(formData: FormData) {
  const itemId = String(formData.get('itemId') ?? '')
  const days = Number(formData.get('days') ?? 3)
  const role = await currentRole()
  if (!itemId) return

  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  await db
    .insert(schema.snoozes)
    .values({ itemId, until, actor: actorFor(role) })
    .onConflictDoUpdate({
      target: schema.snoozes.itemId,
      set: { until, actor: actorFor(role) },
    })
  revalidatePath('/', 'layout')
}

export async function unsnoozeItem(formData: FormData) {
  const itemId = String(formData.get('itemId') ?? '')
  if (!itemId) return
  await db.delete(schema.snoozes).where(eq(schema.snoozes.itemId, itemId))
  revalidatePath('/', 'layout')
}

/**
 * Switch whose queue you are looking at.
 *
 * Takes the role directly rather than a FormData, because the caller is a menu
 * item that unmounts the moment it is clicked — a form submitted by a button
 * that has just been removed from the document does not reliably go through.
 */
export async function setRole(role: string) {
  if (!(ROLES as readonly string[]).includes(role)) return
  const store = await cookies()
  store.set(ROLE_COOKIE, role, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  revalidatePath('/', 'layout')
}

/**
 * The single entry point for everything that arrives from outside.
 *
 * A spreadsheet becomes a program and its records. A policy document becomes a
 * proposed set of changes for somebody to review. Nothing a document says takes
 * effect without a human approving it.
 */
export async function uploadDocument(formData: FormData) {
  const file = formData.get('file')
  const pasted = String(formData.get('text') ?? '').trim()
  const targetProgramId = String(formData.get('programId') ?? '')

  let name: string
  let bodyText: string
  let contentType: string

  if (file instanceof File && file.size > 0) {
    name = file.name
    bodyText = await file.text()
    contentType = file.type || (name.endsWith('.csv') ? 'text/csv' : 'text/markdown')
  } else if (pasted) {
    name = String(formData.get('name') ?? 'pasted-text.md')
    bodyText = pasted
    contentType = 'text/markdown'
  } else {
    redirect('/?error=' + encodeURIComponent('Choose a file or paste some text.'))
  }

  await ingest({ name, bodyText, contentType, targetProgramId })
}

/** Load one of the documents shipped in /samples through the same pipeline. */
export async function loadSample(formData: FormData) {
  const id = String(formData.get('sampleId') ?? '')
  const targetProgramId = String(formData.get('programId') ?? '')
  const sample = SAMPLES.find((s) => s.id === id)
  if (!sample) redirect('/?error=' + encodeURIComponent('Unknown sample.'))

  await ingest({
    name: sample.name,
    bodyText: sample.body,
    contentType: sample.contentType,
    targetProgramId,
  })
}

async function ingest(input: {
  name: string
  bodyText: string
  contentType: string
  targetProgramId: string
}): Promise<never> {
  const { name, bodyText, contentType, targetProgramId } = input
  const isTable = name.toLowerCase().endsWith('.csv') || contentType.includes('csv')
  const blobUrl = await archiveDocument({ name, body: bodyText, contentType })

  const [doc] = await db
    .insert(schema.documents)
    .values({ name, bodyText, contentType, blobUrl })
    .returning()

  if (isTable) {
    const programId = targetProgramId || (await createProgramFromTable(name, bodyText))
    await importRows(programId, bodyText)
    revalidatePath('/', 'layout')
    redirect(`/programs/${programId}?imported=1`)
  }

  const base = targetProgramId ? await currentSpecOf(targetProgramId) : null
  const spec = base?.spec ?? emptySpec(titleFromDocument(name, bodyText))
  const baseVersion = base?.version ?? 0

  const { ops, source } = await extractDelta({
    spec,
    documentName: name,
    bodyText,
    baseVersion,
  })

  const [delta] = await db
    .insert(schema.deltas)
    .values({
      programId: targetProgramId || null,
      baseVersion,
      documentId: doc.id,
      ops,
      status: 'pending',
      extractedBy: source,
    })
    .returning()

  revalidatePath('/', 'layout')
  redirect(`/review/${delta.id}`)
}

/**
 * Approve a reviewed delta. Writes a NEW version row rather than updating the
 * current one, and leaves existing records pinned where they are — a change to
 * the rules is not permission to silently rewrite work already in flight.
 */
export async function approveDelta(formData: FormData) {
  const deltaId = String(formData.get('deltaId') ?? '')
  const selected = formData.getAll('op').map(String)
  const role = await currentRole()

  const [delta] = await db.select().from(schema.deltas).where(eq(schema.deltas.id, deltaId))
  if (!delta) redirect('/')

  const ops: DeltaOp[] = delta.ops
  const chosen =
    selected.length > 0 ? ops.filter((_, i) => selected.includes(String(i))) : ops

  const [document] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, delta.documentId))

  let programId = delta.programId
  let nextVersion = 1
  let baseSpec: Spec

  if (programId) {
    const current = await currentSpecOf(programId)
    baseSpec = current?.spec ?? emptySpec(document?.name ?? 'Program')
    nextVersion = (current?.version ?? 0) + 1
  } else {
    baseSpec = emptySpec(titleFromDocument(document?.name ?? 'Program', document?.bodyText ?? ''))
    const spec = applyOps(baseSpec, chosen)
    const [program] = await db
      .insert(schema.programs)
      .values({ name: spec.name, entity: spec.entity })
      .returning()
    programId = program.id
  }

  const spec = applyOps(baseSpec, chosen)
  if (!spec.initial && spec.states.length > 0) spec.initial = spec.states[0]

  // A program built from a spreadsheet is named by the model's best guess at
  // what the columns describe. The first policy document to arrive knows the
  // real name, so let it say so — but only while nothing has been named by a
  // document yet, so a later amendment can never quietly rename a program.
  const named = baseSpec.rules.some((r) => r.source) || baseSpec.clocks.some((c) => c.source)
  if (!named && document) {
    const title = titleFromDocument(document.name, document.bodyText)
    if (title && title !== spec.name) {
      spec.name = title
      await db
        .update(schema.programs)
        .set({ name: title })
        .where(eq(schema.programs.id, programId))
    }
  }

  await db.insert(schema.programVersions).values({
    programId,
    version: nextVersion,
    spec,
    sourceDocumentId: delta.documentId,
    approvedBy: actorFor(role),
    summary: chosen
      .filter((o) => o.op !== 'unresolved')
      .map((o) => o.summary)
      .join(' '),
  })

  await db
    .update(schema.deltas)
    .set({
      status: 'approved',
      decidedBy: actorFor(role),
      decidedAt: new Date(),
      programId,
    })
    .where(eq(schema.deltas.id, deltaId))

  revalidatePath('/', 'layout')
  redirect(`/programs/${programId}?applied=${nextVersion}`)
}

export async function discardDelta(formData: FormData) {
  const deltaId = String(formData.get('deltaId') ?? '')
  const role = await currentRole()
  await db
    .update(schema.deltas)
    .set({ status: 'discarded', decidedBy: actorFor(role), decidedAt: new Date() })
    .where(eq(schema.deltas.id, deltaId))
  revalidatePath('/', 'layout')
  redirect('/')
}

/**
 * Move a record on. Re-validates against the spec the record is pinned to, so a
 * button rendered a moment ago cannot fire against rules that have since moved.
 */
export async function performTransition(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '')
  const transitionId = String(formData.get('transitionId') ?? '')
  const role = await currentRole()

  const [row] = await db.select().from(schema.records).where(eq(schema.records.id, recordId))
  if (!row) redirect('/records')

  const spec = await specForRecord(row.programId, row.specVersion)
  if (!spec) redirect(`/records/${recordId}`)

  const record: RecordLike = {
    id: row.id,
    ref: row.ref,
    programId: row.programId,
    specVersion: row.specVersion,
    state: row.state,
    data: row.data,
    stateEnteredAt: row.stateEnteredAt,
  }

  const error = validateTransition(spec, record, transitionId, role)
  if (error) {
    redirect(`/records/${recordId}?error=${encodeURIComponent(error)}`)
  }

  const transition = spec.transitions.find((t) => t.id === transitionId)!
  const now = new Date()

  await db
    .update(schema.records)
    .set({ state: transition.to, stateEnteredAt: now, updatedAt: now })
    .where(eq(schema.records.id, recordId))

  await db.insert(schema.events).values({
    recordId,
    type: 'transition',
    actor: actorFor(role),
    payload: {
      from: transition.from,
      to: transition.to,
      label: transition.label,
      clause: transition.source?.clause ?? null,
    },
    at: now,
  })

  const clock = spec.clocks.find((c) => c.fromState === transition.to)
  if (clock) {
    await db.insert(schema.events).values({
      recordId,
      type: 'clock_started',
      actor: 'System',
      payload: { clock: clock.id, days: clock.days, clause: clock.source?.clause ?? null },
      at: now,
    })
  }

  revalidatePath('/', 'layout')
  redirect(`/records/${recordId}`)
}

/** Fill in a field: an evidence link, a signature, a note. */
export async function updateField(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '')
  const key = String(formData.get('key') ?? '')
  const raw = String(formData.get('value') ?? '')
  const type = String(formData.get('type') ?? 'text')
  const role = await currentRole()

  const [row] = await db.select().from(schema.records).where(eq(schema.records.id, recordId))
  if (!row || !key) redirect(`/records/${recordId}`)

  const value = type === 'signature' ? `${actorFor(role)}, ${new Date().toISOString()}` : coerceValue(raw, type)
  const now = new Date()

  await db
    .update(schema.records)
    .set({ data: { ...row.data, [key]: value }, updatedAt: now })
    .where(eq(schema.records.id, recordId))

  await db.insert(schema.events).values({
    recordId,
    type: type === 'signature' ? 'signed' : 'field_updated',
    actor: actorFor(role),
    payload: { key, value: value === null ? null : String(value) },
    at: now,
  })

  revalidatePath('/', 'layout')
  redirect(`/records/${recordId}`)
}

/**
 * Move a record onto the program's current version.
 *
 * Explicit rather than automatic: the whole reason records stay pinned is so a
 * person decides when in-flight work starts being judged by new rules.
 */
export async function migrateRecord(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '')
  const role = await currentRole()
  const [row] = await db.select().from(schema.records).where(eq(schema.records.id, recordId))
  if (!row) redirect('/records')
  await migrateOne(row, actorFor(role))
  revalidatePath('/', 'layout')
  redirect(`/records/${recordId}`)
}

export async function migrateProgram(formData: FormData) {
  const programId = String(formData.get('programId') ?? '')
  const role = await currentRole()
  const current = await currentSpecOf(programId)
  if (!current) redirect('/')

  const rows = await db
    .select()
    .from(schema.records)
    .where(
      and(
        eq(schema.records.programId, programId),
        sql`${schema.records.specVersion} < ${current.version}`,
      ),
    )

  for (const row of rows) await migrateOne(row, actorFor(role))
  revalidatePath('/', 'layout')
  redirect(`/programs/${programId}?migrated=${rows.length}`)
}

async function migrateOne(row: typeof schema.records.$inferSelect, actor: string) {
  const current = await currentSpecOf(row.programId)
  if (!current || current.version === row.specVersion) return
  const from = row.specVersion
  await db
    .update(schema.records)
    .set({ specVersion: current.version, updatedAt: new Date() })
    .where(eq(schema.records.id, row.id))
  await db.insert(schema.events).values({
    recordId: row.id,
    type: 'migrated',
    actor,
    payload: { from, to: current.version },
  })
}

async function specForRecord(programId: string, version: number): Promise<Spec | null> {
  const [row] = await db
    .select()
    .from(schema.programVersions)
    .where(
      and(
        eq(schema.programVersions.programId, programId),
        eq(schema.programVersions.version, version),
      ),
    )
  return row?.spec ?? null
}

/** Exposed so the detail page and the action agree on what is offered. */
export async function transitionsFor(record: RecordLike, spec: Spec, role: Role) {
  return availableTransitions(spec, record, role)
}
