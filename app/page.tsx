import Link from 'next/link'
import { BuildingsIcon, TrayIcon } from '@phosphor-icons/react/dist/ssr'
import { AttentionCard } from '@/components/attention-card'
import { FilterTabs, type Tab, type Tone } from '@/components/filter-tabs'
import { ProgramCard, type FunnelStage, type ProgramCardData } from '@/components/program-card'
import { GrantsPreview, type GrantPreviewRow } from '@/components/grants-preview'
import { UploadDialog } from '@/components/upload-dialog'
import { type Urgency } from '@/lib/engine/attention'
import {
  getFlaggedRecordIds,
  getFlaggedStates,
  getPendingDeltas,
  getPrograms,
  getQueue,
  getQueueCounts,
  getRecentRecords,
  getStateCounts,
  type ProgramSummary,
  type RecordRow,
} from '@/lib/queries'
import { currentRole } from '@/lib/roles'
import { SAMPLE_OPTIONS } from '@/lib/samples'
import { ROLE_LABELS, ROLE_PEOPLE, stateLabel, type Spec } from '@/lib/spec/types'

/** How much of the queue one screen shows before it starts pointing at /grants. */
const QUEUE_PAGE = 50

const URGENCY_TAB: { key: Urgency; label: string; tone: Tone }[] = [
  { key: 'overdue', label: 'Overdue', tone: 'overdue' },
  { key: 'blocked', label: 'Blocked', tone: 'blocked' },
  { key: 'due_soon', label: 'Due Soon', tone: 'due_soon' },
  { key: 'change', label: 'Pending Change', tone: 'change' },
]

type ProgramStatus = 'active' | 'in_review' | 'winding_down' | 'closed_out'

const STATUS_TAB: { key: ProgramStatus; label: string; tone: Tone }[] = [
  { key: 'active', label: 'Active', tone: 'brand' },
  { key: 'in_review', label: 'In Review', tone: 'change' },
  { key: 'winding_down', label: 'Winding Down', tone: 'neutral' },
  { key: 'closed_out', label: 'Closed Out', tone: 'neutral' },
]

export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const params = await searchParams
  const queue = typeof params.queue === 'string' ? params.queue : null
  const status = typeof params.status === 'string' ? params.status : null
  const error = typeof params.error === 'string' ? params.error : null

  const role = await currentRole()

  // Everything here is a count, a page, or a lookup by key. Nothing on this
  // screen loads the full set of grants any more, so what it costs to render
  // no longer depends on how many are in flight.
  const [programs, pending, counts, visibleItems, flaggedIds, flaggedStates, stateCounts] =
    await Promise.all([
      getPrograms(),
      getPendingDeltas(),
      getQueueCounts(role),
      getQueue({ role, urgency: queue, limit: QUEUE_PAGE }),
      getFlaggedRecordIds(),
      getFlaggedStates(),
      getStateCounts(),
    ])

  const queueTabs: Tab[] = [
    { key: 'all', label: 'All', href: '/', active: !queue, tone: 'neutral' },
    ...URGENCY_TAB.filter((t) => counts.byUrgency[t.key] > 0).map((t) => ({
      key: t.key,
      label: t.label,
      count: counts.byUrgency[t.key],
      tone: t.tone,
      href: `/?queue=${t.key}${status ? `&status=${status}` : ''}`,
      active: queue === t.key,
    })),
  ]

  const live = programs.filter((p) => p.currentSpec)
  const recentByProgram = await Promise.all(
    live.map((p) => getRecentRecords(p.id, 5)),
  )
  const totals = new Map(
    live.map((p, i) => [
      p.id,
      [...(stateCounts.get(p.id)?.values() ?? [])].reduce((a, b) => a + b, 0) ||
        recentByProgram[i].length,
    ]),
  )

  const cards = live.map((p, i) =>
    buildProgramCard(p, {
      total: totals.get(p.id) ?? 0,
      byState: stateCounts.get(p.id) ?? new Map(),
      flaggedStates: flaggedStates.get(p.id) ?? new Set(),
      recent: recentByProgram[i],
      flaggedIds,
      pending,
    }),
  )

  const statusTabs: Tab[] = [
    {
      key: 'all',
      label: 'All',
      href: queue ? `/?queue=${queue}` : '/',
      active: !status,
      tone: 'neutral',
    },
    ...STATUS_TAB.filter((t) => cards.some((c) => c.status === t.key)).map((t) => ({
      key: t.key,
      label: t.label,
      count: cards.filter((c) => c.status === t.key).length,
      tone: t.tone,
      href: `/?${queue ? `queue=${queue}&` : ''}status=${t.key}`,
      active: status === t.key,
    })),
  ]
  const visiblePrograms = status ? cards.filter((c) => c.status === status) : cards

  return (
    <div className="grid gap-x-14 gap-y-10 lg:grid-cols-2">
      <section>
        <ColumnHeading icon={<TrayIcon size={30} />} title="To Review" />
        <FilterTabs tabs={queueTabs} className="mt-4 mb-5" />

        {error ? (
          <p className="mb-4 rounded-2xl border border-overdue/30 bg-overdue-soft px-5 py-4 text-[15px] text-overdue">
            {error}
          </p>
        ) : null}

        {visibleItems.length === 0 ? (
          <EmptyQueue
            role={role}
            hasPrograms={programs.length > 0}
            snoozed={counts.snoozed}
          />
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <AttentionCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {counts.total > visibleItems.length && !queue ? (
          <p className="mt-5 text-[15px] text-muted-foreground">
            Showing {visibleItems.length} of {counts.total}.{' '}
            <Link href="/grants?flagged=1" className="underline">
              See everything needing attention
            </Link>
            .
          </p>
        ) : null}

        {counts.snoozed > 0 && !queue ? (
          <p className="mt-2 text-[15px] text-muted-foreground">
            {counts.snoozed} snoozed. They come back on their own — the clocks behind them
            never stopped.
          </p>
        ) : null}
      </section>

      <section>
        <ColumnHeading icon={<BuildingsIcon size={30} />} title="Programs" />
        <FilterTabs tabs={statusTabs} className="mt-4 mb-5" />

        {visiblePrograms.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
            <p className="text-[15px] text-muted-foreground">
              {programs.length === 0
                ? 'No programs yet. Upload a spreadsheet to get a working one, then the contract that governs it.'
                : 'No programs in this state.'}
            </p>
            {programs.length === 0 ? (
              <div className="mt-5 flex justify-center">
                <UploadDialog programs={[]} samples={SAMPLE_OPTIONS} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-6">
            {visiblePrograms.map((card) => (
              <div key={card.id} className="space-y-2">
                <ProgramCard program={card} />
                <GrantsPreview
                  programId={card.id}
                  programName={card.name}
                  total={card.grantCount}
                  rows={card.recentGrants}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ColumnHeading({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-3 text-[30px] font-normal text-heading">
        {icon}
        {title}
      </h1>
      {action}
    </div>
  )
}

function EmptyQueue({
  role,
  hasPrograms,
  snoozed,
}: {
  role: keyof typeof ROLE_LABELS
  hasPrograms: boolean
  snoozed: number
}) {
  return (
    <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
      <p className="text-[17px] font-medium">
        {hasPrograms
          ? `Nothing needs ${ROLE_PEOPLE[role]} right now`
          : 'Nothing to review yet'}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-[15px] text-muted-foreground">
        {snoozed > 0
          ? `${snoozed} snoozed. When a clock runs down, an approval stalls, or a document changes the rules, it shows up here.`
          : 'When a clock runs down, an approval stalls, or a document changes the rules, it shows up here. Switch role in the header to see another queue.'}
      </p>
    </div>
  )
}

/**
 * Three points on a program's lifecycle, counted cumulatively: how much work has
 * reached each stage, not how much is sitting in it. That is the shape people
 * mean by a pipeline, and it survives lifecycles this app has never seen,
 * because the stages come from the spec rather than from a fixed list.
 *
 * Built from a `group by state` rather than from the records themselves, so the
 * funnel costs the same at twelve grants and at twelve thousand.
 */
function funnelFor(
  spec: Spec,
  byState: Map<string, number>,
  flaggedStates: Set<string>,
): FunnelStage[] {
  if (spec.states.length === 0) return []
  const picks =
    spec.states.length <= 3
      ? spec.states
      : [
          spec.states[0],
          spec.states[Math.floor(spec.states.length / 2)],
          spec.states.at(-2)!,
        ]

  return picks.map((state) => {
    const at = spec.states.indexOf(state)
    const reached = spec.states
      .slice(at)
      .reduce((total, s) => total + (byState.get(s) ?? 0), 0)
    return {
      label: stateLabel(state),
      count: reached,
      flagged: flaggedStates.has(state),
    }
  })
}

type ProgramCardInputs = {
  total: number
  byState: Map<string, number>
  flaggedStates: Set<string>
  recent: RecordRow[]
  flaggedIds: Set<string>
  pending: { programId: string | null; id: string }[]
}

function buildProgramCard(
  program: ProgramSummary,
  input: ProgramCardInputs,
): ProgramCardData & {
  status: ProgramStatus
  grantCount: number
  recentGrants: GrantPreviewRow[]
} {
  const spec = program.currentSpec
  const { total, byState, flaggedStates, recent, flaggedIds, pending } = input
  const terminal = spec.states.at(-1)
  const done = terminal ? (byState.get(terminal) ?? 0) : 0
  const hasPending = pending.some((d) => d.programId === program.id)

  const status: ProgramStatus = hasPending
    ? 'in_review'
    : total > 0 && done === total
      ? 'closed_out'
      : total > 0 && done / total > 0.7
        ? 'winding_down'
        : 'active'

  const rules = spec.rules.length
  const clocks = spec.clocks.length
  const entity = program.entity.toLowerCase()

  // Most recently moved first: what changed lately is what somebody is most
  // likely to be looking for. Already ordered and limited by the query.
  const titleKey = spec.fields.find((f) => f.type === 'text')?.key
  const amountKey = spec.fields.find((f) => f.type === 'money')?.key
  const recentGrants: GrantPreviewRow[] = recent.map((r) => ({
    id: r.id,
    ref: r.ref,
    title: titleKey ? String(r.data[titleKey] ?? r.ref) : r.ref,
    amount:
      amountKey && typeof r.data[amountKey] === 'number'
        ? (r.data[amountKey] as number)
        : null,
    state: r.state,
    flagged: flaggedIds.has(r.id),
  }))

  return {
    id: program.id,
    name: program.name,
    version: program.currentVersion,
    pendingVersion: hasPending ? program.currentVersion + 1 : null,
    stages: funnelFor(spec, byState, flaggedStates),
    status,
    grantCount: total,
    recentGrants,
    explain: {
      id: `program:${program.id}`,
      reason: 'Program',
      headline: program.name,
      subline: `Version ${program.currentVersion}, with ${rules} ${rules === 1 ? 'rule' : 'rules'} and ${clocks} ${clocks === 1 ? 'clock' : 'clocks'}, running ${total.toLocaleString('en-US')} ${total === 1 ? entity : `${entity}s`} through ${spec.states.map(stateLabel).join(' \u2192 ')}`,
      programName: program.name,
      recordRef: null,
      ownerName: program.versions.at(-1)?.approvedBy ?? null,
      evidence: spec.rules[0]?.source ?? spec.clocks[0]?.source ?? null,
      resolution:
        'Every rule here traces to a clause. Open the program to see each one with the sentence it came from.',
      ageLabel: `v${program.currentVersion}`,
    },
  }
}
