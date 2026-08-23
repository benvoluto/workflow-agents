/**
 * Reset the database to the demo's starting state.
 *
 * Program A pre-seeded at v2, so the app has a live queue the moment it opens.
 * Program B and the amendment are left out on purpose: those are the beats the
 * demo performs live against the real extractor.
 *
 *   pnpm seed
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { db, schema } from '../lib/db/index'
import { archiveDocument } from '../lib/storage/blob'
import { programAv1, programAv2, programARecords } from '../lib/seed/program-a'
import { ROLE_PEOPLE } from '../lib/spec/types'

const DAY = 24 * 60 * 60 * 1000
const now = new Date()
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY)

const root = join(import.meta.dirname, '..')
const sampleDir = join(root, 'samples', 'milestone-facilities-grant')
const read = (file: string) => readFileSync(join(sampleDir, file), 'utf8')

async function main() {
  console.log('Resetting…')
  // Order matters: events and records reference programs; deltas reference both.
  await db.execute(
    sql`truncate table ${schema.events}, ${schema.deltas}, ${schema.records}, ${schema.programVersions}, ${schema.programs}, ${schema.documents} restart identity cascade`,
  )

  const csvText = read('awards.csv')
  const contractText = read('program-contract.md')

  console.log('Archiving source documents…')
  const [csvUrl, contractUrl] = await Promise.all([
    archiveDocument({ name: 'awards.csv', body: csvText, contentType: 'text/csv' }),
    archiveDocument({
      name: 'program-contract.md',
      body: contractText,
      contentType: 'text/markdown',
    }),
  ])

  const [csvDoc, contractDoc] = await db
    .insert(schema.documents)
    .values([
      {
        name: 'awards.csv',
        bodyText: csvText,
        contentType: 'text/csv',
        blobUrl: csvUrl,
        uploadedAt: daysAgo(20),
      },
      {
        name: 'program-contract.md',
        bodyText: contractText,
        contentType: 'text/markdown',
        blobUrl: contractUrl,
        uploadedAt: daysAgo(13),
      },
    ])
    .returning()

  const [program] = await db
    .insert(schema.programs)
    .values({
      name: programAv2.name,
      entity: programAv2.entity,
      createdAt: daysAgo(20),
    })
    .returning()

  await db.insert(schema.programVersions).values([
    {
      programId: program.id,
      version: 1,
      spec: programAv1,
      sourceDocumentId: csvDoc.id,
      approvedBy: ROLE_PEOPLE.program_officer,
      summary: 'Created from awards.csv — fields and a placeholder lifecycle.',
      createdAt: daysAgo(20),
    },
    {
      programId: program.id,
      version: 2,
      spec: programAv2,
      sourceDocumentId: contractDoc.id,
      approvedBy: ROLE_PEOPLE.program_officer,
      summary:
        'Applied program-contract.md — real lifecycle, dual-signature control, and a 10-day disbursement clock.',
      createdAt: daysAgo(13),
    },
  ])

  console.log(`Seeding ${programARecords.length} awards…`)
  for (const seed of programARecords) {
    const enteredAt = daysAgo(seed.enteredDaysAgo)
    const [record] = await db
      .insert(schema.records)
      .values({
        ref: seed.ref,
        programId: program.id,
        specVersion: 2,
        state: seed.state,
        data: seed.data,
        stateEnteredAt: enteredAt,
        createdAt: daysAgo(20),
        updatedAt: enteredAt,
      })
      .returning()

    // A plausible history, so the detail view has something to show and the
    // provenance story holds up when somebody clicks into a record.
    const history: (typeof schema.events.$inferInsert)[] = [
      {
        recordId: record.id,
        type: 'created',
        actor: 'System',
        payload: { source: 'awards.csv', note: 'Imported from spreadsheet' },
        at: daysAgo(20),
      },
      {
        recordId: record.id,
        type: 'spec_applied',
        actor: ROLE_PEOPLE.program_officer,
        payload: { version: 2, document: 'program-contract.md' },
        at: daysAgo(13),
      },
    ]

    if (seed.state !== 'approved') {
      history.push({
        recordId: record.id,
        type: 'transition',
        actor: ROLE_PEOPLE.program_officer,
        payload: { to: seed.state, clause: '§3.1' },
        at: enteredAt,
      })
    }
    if (seed.state === 'tranche_pending') {
      history.push({
        recordId: record.id,
        type: 'clock_started',
        actor: 'System',
        payload: { clock: 'disbursement_slo', days: 10, clause: '§5.4' },
        at: enteredAt,
      })
    }
    if (
      typeof seed.data.amount === 'number' &&
      seed.data.amount > 50000 &&
      !seed.data.cfo_signature
    ) {
      history.push({
        recordId: record.id,
        type: 'signature_requested',
        actor: 'System',
        payload: { rule: 'dual_signature', from: ROLE_PEOPLE.cfo, clause: '§4.2' },
        at: enteredAt,
      })
    }

    await db.insert(schema.events).values(history)
  }

  console.log('Done.')
  console.log(`  Program: ${program.name} (v2)`)
  console.log(`  Awards:  ${programARecords.length}`)
  console.log('  Not seeded (perform live in the demo): amendment-01.md, Program B')
}

await main()
