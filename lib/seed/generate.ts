import type { Spec } from '@/lib/spec/types'

/**
 * Synthetic awards, for running the system at a scale a demo dataset cannot show.
 *
 * Twelve hand-placed records are enough to prove the attention engine finds
 * every kind of problem. They are not enough to show what happens when the
 * queue is materialised, paged, and recomputed in the background — for that the
 * numbers have to be large enough that loading everything on each page stops
 * being an option.
 *
 * Deterministic on purpose: the same seed gives the same database every time,
 * so a number somebody saw on screen yesterday is still there today.
 */

/** mulberry32 — small, fast, and good enough for demo data. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PLACES = [
  'Northgate', 'Riverbend', 'Cedar Hollow', 'Ashfield', 'Portside', 'Halloway',
  'Kestrel', 'Marlowe Street', 'Tanner Ridge', 'Brightwater', 'Ferndale', 'Oakmoor',
  'Greystone', 'Ellerby', 'Hartsmere', 'Weyburn', 'Castleton', 'Fallowfield',
  'Milbrook', 'Ravensworth', 'Thornbury', 'Alderney', 'Bexley Green', 'Cranmoor',
  'Dunfield', 'Easthaven', 'Foxglove', 'Glenarm', 'Harrowgate', 'Inglewood',
  'Juniper Vale', 'Kirkstall', 'Langford', 'Merrivale', 'Netherby', 'Ockbrook',
  'Pemberton', 'Quarrydale', 'Rosslare', 'Stanmore', 'Tewkes Bridge', 'Ullswater',
  'Vale End', 'Westmere', 'Yarrowfield', 'Abbotsleigh', 'Blakeney', 'Corville',
  'Draycott', 'Edgewater', 'Fenwick', 'Garrowby', 'Hinton Cross', 'Ivybridge',
  'Kenmare', 'Lowestead', 'Marchmont', 'Newbiggin', 'Orlingbury', 'Penrhos',
]

const KINDS = [
  'Community Trust', 'Housing Collective', 'Youth Services', 'Works', 'Learning Alliance',
  'Neighbourhood Centre', 'Vocational Institute', 'Clinic', 'Cooperative',
  'Arts Foundation', 'Mutual Aid', 'Technical College', 'Care Partnership',
  'Food Network', 'Family Centre', 'Skills Hub', 'Community Kitchen',
  'Enterprise Trust', 'Wellbeing Project', 'Resource Centre',
]

const DOMAINS = ['org', 'co', 'net', 'community', 'health']
const MAILBOXES = ['grants', 'finance', 'admin', 'ops', 'hello', 'office', 'contact']

export type GeneratedRecord = {
  id: string
  ref: string
  state: string
  enteredDaysAgo: number
  createdDaysAgo: number
  data: Record<string, unknown>
}

export type StateMix = { state: string; share: number; maxDaysInState: number }

export type GenerateOptions = {
  spec: Spec
  count: number
  refPrefix: string
  refStart: number
  seed: number
  mix: StateMix[]
  /** Field keys the generated data has to fill, by role in the program. */
  keys: {
    party: string
    amount: string
    date: string
    extra?: Record<string, (r: () => number, amount: number, state: string) => unknown>
  }
  amount: { min: number; max: number }
  /** Names guaranteed to appear, so a party can be shared across programs. */
  include?: string[]
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z]+/g, '')
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * Build a population whose shape gives the queue something honest to say: most
 * work finished, a long tail in flight, and a minority of that tail genuinely
 * late rather than uniformly late.
 */
export function generateRecords(options: GenerateOptions): GeneratedRecord[] {
  const r = rng(options.seed)
  const { keys, amount, mix } = options
  const out: GeneratedRecord[] = []

  // Expand the mix into a per-record state list, then shuffle, so the counts
  // land exactly on the shares rather than approximately.
  const states: StateMix[] = []
  for (const entry of mix) {
    const n = Math.round(entry.share * options.count)
    for (let i = 0; i < n; i++) states.push(entry)
  }
  while (states.length < options.count) states.push(mix[mix.length - 1])
  for (let i = states.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[states[i], states[j]] = [states[j], states[i]]
  }

  for (let i = 0; i < options.count; i++) {
    const entry = states[i]
    const forced = options.include?.[i]
    const party =
      forced ??
      `${PLACES[Math.floor(r() * PLACES.length)]} ${KINDS[Math.floor(r() * KINDS.length)]}`

    // Log-ish distribution: many small awards, a few large ones. A flat spread
    // would put half the population over every threshold, which makes a rule
    // that is supposed to be exceptional look like the norm.
    const span = Math.log(amount.max / amount.min)
    const value = Math.round((amount.min * Math.exp(r() * span)) / 100) * 100

    const enteredDaysAgo = Math.floor(r() * entry.maxDaysInState)
    const createdDaysAgo = enteredDaysAgo + 1 + Math.floor(r() * 40)

    const data: Record<string, unknown> = {
      [keys.party]: party,
      [keys.amount]: value,
      [keys.date]: isoDaysAgo(createdDaysAgo),
      contact: `${MAILBOXES[Math.floor(r() * MAILBOXES.length)]}@${slug(party).slice(0, 18)}.${
        DOMAINS[Math.floor(r() * DOMAINS.length)]
      }`,
      notes: null,
    }
    for (const [key, make] of Object.entries(keys.extra ?? {})) {
      data[key] = make(r, value, entry.state)
    }

    out.push({
      id: crypto.randomUUID(),
      ref: `${options.refPrefix}-${options.refStart + i}`,
      state: entry.state,
      enteredDaysAgo,
      createdDaysAgo,
      data,
    })
  }

  return out
}
