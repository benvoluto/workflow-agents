import Link from 'next/link'
import { ListChecksIcon } from '@phosphor-icons/react/dist/ssr'
import { Badge } from '@/components/ui/badge'
import { FilterTabs, type Tab } from '@/components/filter-tabs'
import { PageHeading } from '@/components/page-heading'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StateChip } from '@/components/state-chip'
import { ageLabel, money } from '@/lib/format'
import {
  countRecords,
  getFlaggedRecordIds,
  getItemsForRecords,
  getPartyIndex,
  getPrograms,
  getRecordPage,
  getStateCounts,
} from '@/lib/queries'
import { owningRole } from '@/lib/engine/runtime'
import { ROLE_LABELS, stateLabel } from '@/lib/spec/types'
import { cn, STRETCHED } from '@/lib/utils'

/** One screen of grants. The point of paging is that the cost of this page no
 *  longer moves when a program goes from twelve awards to twelve thousand. */
const PAGE_SIZE = 50

export default async function RecordsPage({ searchParams }: PageProps<'/grants'>) {
  const params = await searchParams
  const programFilter = typeof params.program === 'string' ? params.program : null
  const stateFilter = typeof params.state === 'string' ? params.state : null
  const onlyFlagged = params.flagged === '1'

  const page = Number(typeof params.page === 'string' ? params.page : '1') || 1
  const now = new Date()

  const [programs, flaggedIds, stateCounts, total] = await Promise.all([
    getPrograms(),
    getFlaggedRecordIds(programFilter ?? undefined),
    getStateCounts(),
    countRecords(programFilter ?? undefined),
  ])

  // One page of records, chosen in SQL. "Needs attention" is a filter on the
  // materialised queue rather than a scan: the ids come from the cache, and only
  // those rows are fetched.
  const visible = await getRecordPage({
    programId: programFilter ?? undefined,
    state: stateFilter ?? undefined,
    flaggedOnly: onlyFlagged,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })

  const [items, shared] = await Promise.all([
    getItemsForRecords(visible.map((r) => r.id)),
    getPartyIndex(programs),
  ])

  const matching = onlyFlagged
    ? flaggedIds.size
    : stateFilter
      ? [...stateCounts.values()].reduce((n, byState) => n + (byState.get(stateFilter) ?? 0), 0)
      : total

  const states = [
    ...new Set([...stateCounts.values()].flatMap((byState) => [...byState.keys()])),
  ].sort()

  const tabs: Tab[] = [
    {
      key: 'all',
      label: 'All',
      href: '/grants',
      active: !programFilter && !stateFilter && !onlyFlagged,
    },
    ...programs.map((p) => ({
      key: p.id,
      label: p.name,
      href: `/grants?program=${p.id}`,
      active: programFilter === p.id,
      tone: 'brand' as const,
    })),
    ...states.map((s) => ({
      key: s,
      label: stateLabel(s),
      href: `/grants?state=${s}`,
      active: stateFilter === s,
    })),
    {
      key: 'flagged',
      label: 'Needs attention',
      count: flaggedIds.size,
      href: '/grants?flagged=1',
      active: onlyFlagged,
      tone: 'overdue' as const,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeading
        icon={<ListChecksIcon size={30} />}
        title="Grants"
        back={{ href: '/', label: 'To Review' }}
        meta={`${visible.length ? (page - 1) * PAGE_SIZE + 1 : 0}–${
          (page - 1) * PAGE_SIZE + visible.length
        } of ${matching.toLocaleString('en-US')} across ${
          programs.length === 1 ? '1 program' : `${programs.length} programs`
        }`}
      />

      <FilterTabs tabs={tabs} />

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
          No records match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Program</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>State</TableHead>
                <TableHead>With</TableHead>
                <TableHead className="text-right">Age</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((record) => {
                const program = programs.find((p) => p.id === record.programId)
                const spec =
                  program?.versions.find((v) => v.version === record.specVersion)?.spec ??
                  program?.currentSpec
                if (!spec) return null
                const titleKey = spec.fields.find((f) => f.type === 'text')?.key
                const amountKey = spec.fields.find((f) => f.type === 'money')?.key
                const title = titleKey ? String(record.data[titleKey] ?? record.ref) : record.ref
                const role = owningRole(spec, record)
                const flags = items.get(record.id) ?? []
                const isShared = shared.has(title)

                return (
                  <TableRow key={record.id} className="group relative cursor-pointer">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {record.ref}
                    </TableCell>
                    <TableCell className="font-medium">
                      {/* One link, stretched across the row. */}
                      <Link
                        href={`/grants/${record.id}`}
                        className={cn('group-hover:underline', STRETCHED)}
                      >
                        {title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {program?.name}
                      {record.specVersion < (program?.currentVersion ?? 0) ? (
                        <span className="ml-1 text-xs">v{record.specVersion}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {amountKey ? money(record.data[amountKey]) : '—'}
                    </TableCell>
                    <TableCell>
                      <StateChip state={record.state} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role ? ROLE_LABELS[role] : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {ageLabel(record.stateEnteredAt, now)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {flags.map((f) => (
                          <Badge
                            key={f.id}
                            variant="outline"
                            className={cn(
                              'text-[11px]',
                              f.urgency === 'overdue' &&
                                'border-red-600/25 bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300',
                            )}
                          >
                            {f.reason}
                          </Badge>
                        ))}
                        {isShared ? (
                          <Badge variant="outline" className="text-[11px]">
                            In 2 programs
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {matching > PAGE_SIZE ? (
        <div className="flex items-center justify-between text-sm">
          <PageLink
            page={page - 1}
            params={params}
            disabled={page <= 1}
            label="\u2190 Previous"
          />
          <span className="text-muted-foreground">
            Page {page} of {Math.max(1, Math.ceil(matching / PAGE_SIZE))}
          </span>
          <PageLink
            page={page + 1}
            params={params}
            disabled={page * PAGE_SIZE >= matching}
            label="Next \u2192"
          />
        </div>
      ) : null}
    </div>
  )
}

function PageLink({
  page,
  params,
  disabled,
  label,
}: {
  page: number
  params: Record<string, string | string[] | undefined>
  disabled: boolean
  label: string
}) {
  if (disabled) {
    return <span className="text-muted-foreground/50">{label}</span>
  }
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && key !== 'page') next.set(key, value)
  }
  next.set('page', String(page))
  return (
    <Link href={`/grants?${next.toString()}`} className="underline underline-offset-4">
      {label}
    </Link>
  )
}
