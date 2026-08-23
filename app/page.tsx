import { BuildingsIcon, TrayIcon } from '@phosphor-icons/react/dist/ssr'
import { AttentionCard } from '@/components/attention-card'
import { FilterTabs, type Tab, type Tone } from '@/components/filter-tabs'
import { ProgramCard, type FunnelStage, type ProgramCardData } from '@/components/program-card'
import { UploadDialog } from '@/components/upload-dialog'
import {
  attention,
  visibleTo,
  type AttentionItem,
  type Urgency,
} from '@/lib/engine/attention'
import {
  getPendingDeltas,
  getPrograms,
  getRecords,
  getSnoozedItemIds,
  toContexts,
  type ProgramSummary,
  type RecordRow,
} from '@/lib/queries'
import { currentRole } from '@/lib/roles'
import { SAMPLE_OPTIONS } from '@/lib/samples'
import { ROLE_LABELS, ROLE_PEOPLE, stateLabel, type Spec } from '@/lib/spec/types'

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

  const [role, programs, records, pending, snoozed] = await Promise.all([
    currentRole(),
    getPrograms(),
    getRecords(),
    getPendingDeltas(),
    getSnoozedItemIds(),
  ])

  const all = attention(toContexts(programs), records, new Date())
  const mine = all.filter((i) => visibleTo(i, role))
  const live = mine.filter((i) => !snoozed.has(i.id))

  const queueTabs: Tab[] = [
    { key: 'all', label: 'All', href: '/', active: !queue, tone: 'neutral' },
    ...URGENCY_TAB.filter((t) => live.some((i) => i.urgency === t.key)).map((t) => ({
      key: t.key,
      label: t.label,
      count: live.filter((i) => i.urgency === t.key).length,
      tone: t.tone,
      href: `/?queue=${t.key}${status ? `&status=${status}` : ''}`,
      active: queue === t.key,
    })),
  ]

  const visibleItems = queue ? live.filter((i) => i.urgency === queue) : live

  const cards = programs
    .filter((p) => p.currentSpec)
    .map((p) => buildProgramCard(p, records, all, pending))

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
            snoozed={mine.length - live.length}
          />
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <AttentionCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {mine.length > live.length && !queue ? (
          <p className="mt-5 text-[15px] text-muted-foreground">
            {mine.length - live.length} snoozed. They come back on their own — the clocks
            behind them never stopped.
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
          <div className="space-y-4">
            {visiblePrograms.map((card) => (
              <ProgramCard key={card.id} program={card} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ColumnHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h1 className="flex items-center gap-3 text-[30px] font-normal text-heading">
      {icon}
      {title}
    </h1>
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
 */
function funnelFor(spec: Spec, mine: RecordRow[], flagged: Set<string>): FunnelStage[] {
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
    const reached = mine.filter((r) => spec.states.indexOf(r.state) >= at)
    return {
      label: stateLabel(state),
      count: reached.length,
      flagged: reached.some(
        (r) => flagged.has(r.id) && spec.states.indexOf(r.state) === at,
      ),
    }
  })
}

function buildProgramCard(
  program: ProgramSummary,
  records: RecordRow[],
  items: AttentionItem[],
  pending: { programId: string | null; id: string }[],
): ProgramCardData & { status: ProgramStatus } {
  const spec = program.currentSpec
  const mine = records.filter((r) => r.programId === program.id)
  const flagged = new Set(items.map((i) => i.recordId).filter(Boolean) as string[])
  const terminal = spec.states.slice(-1)
  const done = mine.filter((r) => terminal.includes(r.state)).length
  const hasPending = pending.some((d) => d.programId === program.id)

  const status: ProgramStatus = hasPending
    ? 'in_review'
    : mine.length > 0 && done === mine.length
      ? 'closed_out'
      : mine.length > 0 && done / mine.length > 0.7
        ? 'winding_down'
        : 'active'

  const rules = spec.rules.length
  const clocks = spec.clocks.length
  const entity = program.entity.toLowerCase()

  return {
    id: program.id,
    name: program.name,
    version: program.currentVersion,
    pendingVersion: hasPending ? program.currentVersion + 1 : null,
    stages: funnelFor(spec, mine, flagged),
    status,
    explain: {
      id: `program:${program.id}`,
      reason: 'Program',
      headline: program.name,
      subline: `Version ${program.currentVersion}, with ${rules} ${rules === 1 ? 'rule' : 'rules'} and ${clocks} ${clocks === 1 ? 'clock' : 'clocks'}, running ${mine.length} ${mine.length === 1 ? entity : `${entity}s`} through ${spec.states.map(stateLabel).join(' → ')}`,
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
