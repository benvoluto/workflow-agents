import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  uuid,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import type { Spec } from '@/lib/spec/types'
import type { DeltaOp } from '@/lib/spec/delta'

/**
 * Uploaded source documents. `bodyText` is what the extractor reads; `blobUrl`
 * points at the archived original, served back through the app rather than
 * directly, because the store is private.
 */
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  bodyText: text('body_text').notNull(),
  contentType: text('content_type').notNull().default('text/markdown'),
  blobUrl: text('blob_url'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * A program family. Stable identity across every version of its spec — this is
 * what a record belongs to.
 */
export const programs = pgTable('programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  entity: text('entity').notNull().default('Record'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * One row per approved version of a program's spec. Never updated — a new
 * version is a new row, which is what makes provenance answerable.
 */
export const programVersions = pgTable(
  'program_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    spec: jsonb('spec').$type<Spec>().notNull(),
    sourceDocumentId: uuid('source_document_id').references(() => documents.id),
    approvedBy: text('approved_by'),
    summary: text('summary'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('program_version_unique').on(t.programId, t.version)],
)

/**
 * A live item of work. `specVersion` pins the record to the version it is being
 * run under, so a newly approved version does not silently rewrite history.
 */
export const records = pgTable(
  'records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ref: text('ref').notNull(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    specVersion: integer('spec_version').notNull(),
    state: text('state').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    stateEnteredAt: timestamp('state_entered_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('record_ref_unique').on(t.ref),
    index('record_program_idx').on(t.programId),
  ],
)

/** Append-only audit trail. Every state or data change writes one. */
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordId: uuid('record_id')
      .notNull()
      .references(() => records.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    actor: text('actor').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('event_record_idx').on(t.recordId, t.at)],
)

/**
 * An extracted, not-yet-approved set of spec operations. Persisted rather than
 * held in the client so an upload survives a refresh mid-demo.
 */
export const deltas = pgTable(
  'deltas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id').references(() => programs.id, {
      onDelete: 'cascade',
    }),
    baseVersion: integer('base_version'),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    ops: jsonb('ops').$type<DeltaOp[]>().notNull(),
    status: text('status').notNull().default('pending'),
    extractedBy: text('extracted_by').notNull().default('live'),
    decidedBy: text('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('delta_status_idx').on(t.status)],
)

/**
 * A queue item somebody has chosen to stop seeing for a while.
 *
 * Keyed by the attention item's own stable id rather than by record, because a
 * record can be in the queue for two unrelated reasons at once and silencing
 * one of them should not silence the other.
 */
export const snoozes = pgTable(
  'snoozes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: text('item_id').notNull(),
    until: timestamp('until', { withTimezone: true }).notNull(),
    actor: text('actor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('snooze_item_unique').on(t.itemId)],
)
