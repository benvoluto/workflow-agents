/**
 * Run the real extractors over every sample document and commit the results.
 *
 * This is the "cached fallback" half of the extraction strategy: the app always
 * tries a live model call first, and drops back to one of these only when that
 * call fails or times out. Running this is also the honest way to see what the
 * extractor actually produces before standing in front of an audience with it.
 *
 *   pnpm fixtures
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractDelta, inferSpecFromTable } from '../lib/ingest/extract'
import { fixtureKey } from '../lib/ingest/fixtures'
import { emptySpec, titleFromDocument } from '../lib/spec/starter'
import { programAv1, programAv2 } from '../lib/seed/program-a'
import { SAMPLES } from '../lib/samples.generated'
import type { Spec } from '../lib/spec/types'

const out = join(import.meta.dirname, '..', 'lib', 'ingest', 'fixtures.generated.json')
const fixtures: Record<string, unknown> = {}

function sample(id: string) {
  const s = SAMPLES.find((x) => x.id === id)
  if (!s) throw new Error(`Missing sample ${id}`)
  return s
}

async function table(id: string) {
  const s = sample(id)
  process.stdout.write(`infer-spec  ${s.id} … `)
  const { spec } = await inferSpecFromTable({ fileName: s.name, tableText: s.body })
  fixtures[fixtureKey(['infer-spec', s.name, s.body])] = spec
  console.log(`${spec.fields.length} fields, ${spec.states.length} states`)
  return spec
}

async function delta(id: string, base: Spec, baseVersion: number) {
  const s = sample(id)
  process.stdout.write(`delta       ${s.id} vs v${baseVersion} … `)
  const { ops } = await extractDelta({
    spec: base,
    documentName: s.name,
    bodyText: s.body,
    baseVersion,
  })
  const key = fixtureKey([
    'extract-delta',
    s.name,
    s.body,
    baseVersion,
    JSON.stringify(base),
  ])
  fixtures[key] = { ops }
  const kinds = ops.reduce<Record<string, number>>((acc, op) => {
    acc[op.op] = (acc[op.op] ?? 0) + 1
    return acc
  }, {})
  console.log(
    Object.entries(kinds)
      .map(([k, n]) => `${k}×${n}`)
      .join(' '),
  )
  return ops
}

// Spreadsheets: the path that turns a messy table into a first working program.
await table('milestone-facilities-grant/awards.csv')
await table('startup-lump-sum-grant/awards.csv')

// The core demo beat: an amendment landing on a program already in flight.
await delta('milestone-facilities-grant/amendment-01.md', programAv2, 2)

// The contract that produced the seeded v2, for anyone who runs the flow from
// an empty database rather than from the seed.
await delta('milestone-facilities-grant/program-contract.md', programAv1, 1)

// Program B: a contract creating a program from nothing.
const bName = titleFromDocument(
  'program-contract.md',
  sample('startup-lump-sum-grant/program-contract.md').body,
)
await delta('startup-lump-sum-grant/program-contract.md', emptySpec(bName), 0)

writeFileSync(out, JSON.stringify(fixtures, null, 2) + '\n')
console.log(`\nWrote ${Object.keys(fixtures).length} fixtures to lib/ingest/fixtures.generated.json`)
