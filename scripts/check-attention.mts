/** Print the attention queue as the app would compute it. Sanity check. */
import { eq } from 'drizzle-orm'
import { db, schema } from '../lib/db/index'
import { attention, type ProgramContext } from '../lib/engine/attention'
import type { RecordLike } from '../lib/engine/runtime'

const programs = await db.select().from(schema.programs)
const versions = await db.select().from(schema.programVersions)
const rows = await db.select().from(schema.records)

const contexts: ProgramContext[] = programs.map((p) => {
  const mine = versions.filter((v) => v.programId === p.id)
  const latest = mine.reduce((a, b) => (a.version > b.version ? a : b))
  return {
    programId: p.id,
    programName: p.name,
    currentVersion: latest.version,
    currentSpec: latest.spec,
    specByVersion: Object.fromEntries(mine.map((v) => [v.version, v.spec])),
  }
})

const records: RecordLike[] = rows.map((r) => ({
  id: r.id,
  ref: r.ref,
  programId: r.programId,
  specVersion: r.specVersion,
  state: r.state,
  data: r.data,
  stateEnteredAt: r.stateEnteredAt,
}))

const items = attention(contexts, records, new Date())
let group = ''
for (const i of items) {
  if (i.urgency !== group) {
    group = i.urgency
    console.log(`\n== ${group.toUpperCase()} ==`)
  }
  console.log(
    `  [${i.reason}] ${i.headline}\n      ${i.subline}\n      owner=${i.ownerRole} age=${i.ageLabel}`,
  )
}
console.log(`\nTotal items: ${items.length}`)
void eq
