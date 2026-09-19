/**
 * Seed both programs at realistic scale, then build the materialised queue.
 *
 *   pnpm seed:scale            two programs, ~1,100 awards each
 *   pnpm seed:scale 5000       or any size you want to push it to
 *
 * `pnpm seed` still produces the twelve hand-placed awards the demo script is
 * written against. This is the other thing: enough records that recomputing the
 * queue on every page load would stop being reasonable, so the background
 * machinery has something to actually do.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { db, schema } from '../lib/db/index'
import { recomputeAll, verifyQueue } from '../lib/engine/materialize'
import { generateRecords, type GeneratedRecord } from '../lib/seed/generate'
import { programAv1, programAv2, programARecords } from '../lib/seed/program-a'
import { programBv1, programBv2 } from '../lib/seed/program-b'
import { ROLE_PEOPLE, type Spec } from '../lib/spec/types'

const DAY = 24 * 60 * 60 * 1000
const now = new Date()
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY)

const PER_PROGRAM = Number(process.argv[2] ?? 1100)
const CHUNK = 400

const root = join(import.meta.dirname, '..')
const read = (program: string, file: string) =>
  readFileSync(join(root, 'samples', program, file), 'utf8')

/** Insert in batches. One round trip per row is unusable past a few hundred. */
async function insertAll<T>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
  label: string,
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(table).values(rows.slice(i, i + CHUNK) as never)
    process.stdout.write(`\r  ${label}: ${Math.min(i + CHUNK, rows.length)}/${rows.length}   `)
  }
  process.stdout.write('\n')
}

/**
 * A plausible history per record. Kept to three events rather than a full
 * reconstruction: the detail page needs something to show, and the volume here
 * is already four times the record count.
 */
function eventsFor(
  record: GeneratedRecord,
  spec: Spec,
  document: string,
): (typeof schema.events.$inferInsert)[] {
  const entered = daysAgo(record.enteredDaysAgo)
  const out: (typeof schema.events.$inferInsert)[] = [
    {
      recordId: record.id,
      type: 'created',
      actor: 'System',
      payload: { source: 'awards.csv', note: 'Imported from spreadsheet' },
      at: daysAgo(record.createdDaysAgo),
    },
    {
      recordId: record.id,
      type: 'spec_applied',
      actor: ROLE_PEOPLE.program_officer,
      payload: { version: 2, document },
      at: daysAgo(Math.min(record.createdDaysAgo, 13)),
    },
  ]

  if (record.state !== spec.initial) {
    const transition = spec.transitions.find((t) => t.to === record.state)
    out.push({
      recordId: record.id,
      type: 'transition',
      actor: ROLE_PEOPLE.program_officer,
      payload: { to: record.state, clause: transition?.source?.clause ?? null },
      at: entered,
    })
  }

  const clock = spec.clocks.find((c) => c.fromState === record.state)
  if (clock) {
    out.push({
      recordId: record.id,
      type: 'clock_started',
      actor: 'System',
      payload: { clock: clock.id, days: clock.days, clause: clock.source?.clause ?? null },
      at: entered,
    })
  }

  return out
}

async function main() {
  const started = Date.now()
  console.log(`Resetting, then seeding ~${PER_PROGRAM.toLocaleString('en-US')} awards per program…\n`)

  await db.execute(
    sql`truncate table ${schema.queueRuns}, ${schema.recordWakeups}, ${schema.attentionItems}, ${schema.events}, ${schema.deltas}, ${schema.snoozes}, ${schema.records}, ${schema.programVersions}, ${schema.programs}, ${schema.documents} restart identity cascade`,
  )

  const docs = await db
    .insert(schema.documents)
    .values([
      {
        name: 'awards.csv',
        bodyText: read('milestone-facilities-grant', 'awards.csv'),
        contentType: 'text/csv',
        uploadedAt: daysAgo(20),
      },
      {
        name: 'program-contract.md',
        bodyText: read('milestone-facilities-grant', 'program-contract.md'),
        contentType: 'text/markdown',
        uploadedAt: daysAgo(13),
      },
      {
        name: 'awards.csv',
        bodyText: read('startup-lump-sum-grant', 'awards.csv'),
        contentType: 'text/csv',
        uploadedAt: daysAgo(18),
      },
      {
        name: 'program-contract.md',
        bodyText: read('startup-lump-sum-grant', 'program-contract.md'),
        contentType: 'text/markdown',
        uploadedAt: daysAgo(11),
      },
    ])
    .returning()

  const [aCsv, aContract, bCsv, bContract] = docs

  const [programA, programB] = await db
    .insert(schema.programs)
    .values([
      { name: programAv2.name, entity: programAv2.entity, createdAt: daysAgo(20) },
      { name: programBv2.name, entity: programBv2.entity, createdAt: daysAgo(18) },
    ])
    .returning()

  await db.insert(schema.programVersions).values([
    {
      programId: programA.id,
      version: 1,
      spec: programAv1,
      sourceDocumentId: aCsv.id,
      approvedBy: ROLE_PEOPLE.program_officer,
      summary: 'Created from awards.csv — fields and a placeholder lifecycle.',
      createdAt: daysAgo(20),
    },
    {
      programId: programA.id,
      version: 2,
      spec: programAv2,
      sourceDocumentId: aContract.id,
      approvedBy: ROLE_PEOPLE.program_officer,
      summary:
        'Applied program-contract.md — real lifecycle, dual-signature control, and a 10-day disbursement clock.',
      createdAt: daysAgo(13),
    },
    {
      programId: programB.id,
      version: 1,
      spec: programBv1,
      sourceDocumentId: bCsv.id,
      approvedBy: ROLE_PEOPLE.program_officer,
      summary: 'Created from awards.csv — fields and a placeholder lifecycle.',
      createdAt: daysAgo(18),
    },
    {
      programId: programB.id,
      version: 2,
      spec: programBv2,
      sourceDocumentId: bContract.id,
      approvedBy: ROLE_PEOPLE.program_officer,
      summary:
        'Applied program-contract.md — single-payment lifecycle and a 5-day payment clock.',
      createdAt: daysAgo(11),
    },
  ])

  /**
   * §4.2 puts the CFO counter-signature before the release of funds, so where
   * it is outstanding says as much as whether it is. An award that has been
   * disbursed was signed — a closed award still waiting on the CFO is not a
   * backlog, it is a contradiction. The genuine gap sits in the two states
   * ahead of release, and only on a minority of those.
   */
  const signature = (r: () => number, amount: number, state: string) => {
    if (amount <= 50000) return null
    const signed = `${ROLE_PEOPLE.cfo}, ${1 + Math.floor(r() * 20)}d ago`
    if (state === 'approved') return r() < 0.3 ? null : signed
    if (state === 'tranche_pending') return r() < 0.12 ? null : signed
    return signed
  }

  const awardsA = generateRecords({
    spec: programAv2,
    count: PER_PROGRAM,
    refPrefix: 'AWD',
    refStart: 1053,
    seed: 20260919,
    amount: { min: 8000, max: 400000 },
    // Disbursement SLO is 10 days, escalating at 7. Most tranches are released
    // inside a working week; the bands past that are deliberately thin, and
    // start clear of the threshold so a dataset seeded today does not drift
    // into a wall of breaches by the end of the week.
    mix: [
      { state: 'closed', share: 0.44, maxDaysInState: 60 },
      { state: 'paid', share: 0.15, maxDaysInState: 30 },
      { state: 'evidence_review', share: 0.15, maxDaysInState: 21 },
      { state: 'tranche_pending', share: 0.141, maxDaysInState: 5 },
      { state: 'tranche_pending', share: 0.012, minDaysInState: 7, maxDaysInState: 10 },
      { state: 'tranche_pending', share: 0.007, minDaysInState: 11, maxDaysInState: 18 },
      { state: 'approved', share: 0.1, maxDaysInState: 12 },
    ],
    keys: {
      party: 'provider',
      amount: 'amount',
      date: 'approval_date',
      extra: {
        milestone_count: (r) => 1 + Math.floor(r() * 6),
        cfo_signature: (r, amount, state) => signature(r, amount, state),
        evidence_url: (r, _amount, state) => {
          if (state === 'approved' || state === 'tranche_pending') return null
          // A minority reach evidence review with nothing recorded — the
          // "missing information" branch of the engine.
          if (state === 'evidence_review' && r() < 0.11) return null
          return `https://example.org/evidence/${Math.floor(r() * 1e6)}`
        },
      },
    },
  })

  const awardsB = generateRecords({
    spec: programBv2,
    count: PER_PROGRAM,
    refPrefix: 'SLG',
    refStart: 5001,
    seed: 76301,
    amount: { min: 2000, max: 25000 },
    // Payment SLO is 5 days, escalating at 3 — a short clock, so the healthy
    // band has to be short too, and there is less room for the data to age
    // before the warning band starts filling up.
    mix: [
      { state: 'closed', share: 0.5, maxDaysInState: 50 },
      { state: 'paid', share: 0.18, maxDaysInState: 24 },
      { state: 'payment_pending', share: 0.17, maxDaysInState: 2 },
      { state: 'payment_pending', share: 0.02, minDaysInState: 3, maxDaysInState: 5 },
      { state: 'payment_pending', share: 0.01, minDaysInState: 6, maxDaysInState: 12 },
      { state: 'approved', share: 0.12, maxDaysInState: 9 },
    ],
    keys: {
      party: 'recipient',
      amount: 'amount',
      date: 'decision_date',
      extra: {
        // Receipt confirmation lags payment by days, not weeks. What is
        // outstanding is the recent end of the paid pile, not most of it.
        receipt_confirmed: (r, _amount, state) =>
          state === 'closed' ? true : state === 'paid' ? r() > 0.12 : false,
      },
    },
    // Program A's providers, so the shared-party flag has something real to
    // find: the same organisation drawing from two programs at once.
    include: [
      'Tanner Ridge Cooperative',
      'Brightwater Arts Foundation',
      'Ferndale Mutual Aid',
      'Cedar Hollow Youth Services',
      'Portside Learning Alliance',
    ],
  })

  // The twelve hand-placed awards stay exactly as they are: the demo script
  // names them, and every branch of the engine is positioned through them.
  const heroes = programARecords.map((seed) => ({
    id: crypto.randomUUID(),
    ref: seed.ref,
    state: seed.state,
    enteredDaysAgo: seed.enteredDaysAgo,
    createdDaysAgo: 20,
    data: seed.data,
  }))

  const rows = [
    ...[...heroes, ...awardsA].map((rec) => ({
      id: rec.id,
      ref: rec.ref,
      programId: programA.id,
      specVersion: 2,
      state: rec.state,
      data: rec.data,
      stateEnteredAt: daysAgo(rec.enteredDaysAgo),
      createdAt: daysAgo(rec.createdDaysAgo),
      updatedAt: daysAgo(rec.enteredDaysAgo),
    })),
    ...awardsB.map((rec) => ({
      id: rec.id,
      ref: rec.ref,
      programId: programB.id,
      specVersion: 2,
      state: rec.state,
      data: rec.data,
      stateEnteredAt: daysAgo(rec.enteredDaysAgo),
      createdAt: daysAgo(rec.createdDaysAgo),
      updatedAt: daysAgo(rec.enteredDaysAgo),
    })),
  ]

  await insertAll(schema.records, rows, 'records')

  const events = [
    ...[...heroes, ...awardsA].flatMap((rec) =>
      eventsFor(rec, programAv2, 'program-contract.md'),
    ),
    ...awardsB.flatMap((rec) => eventsFor(rec, programBv2, 'program-contract.md')),
  ]
  await insertAll(schema.events, events, 'events ')

  console.log('\nBuilding the materialised queue…')
  const built = Date.now()
  const result = await recomputeAll(now)
  const buildMs = Date.now() - built

  console.log('Verifying the cache against a fresh run of the engine…')
  const verification = await verifyQueue(now)

  console.log('\nDone in ' + ((Date.now() - started) / 1000).toFixed(1) + 's.')
  console.log(`  Programs:      ${programA.name} (v2), ${programB.name} (v2)`)
  console.log(`  Records:       ${rows.length.toLocaleString('en-US')}`)
  console.log(`  Events:        ${events.length.toLocaleString('en-US')}`)
  console.log(`  Queue items:   ${result.written.toLocaleString('en-US')} in ${buildMs}ms`)
  console.log(
    `  Verification:  ${verification.ok ? 'cache matches the engine' : `MISMATCH — ${verification.missing.length} missing, ${verification.extra.length} extra, ${verification.changed.length} changed`}`,
  )
  if (!verification.ok) process.exitCode = 1
}

await main()
