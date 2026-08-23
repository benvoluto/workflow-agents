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
import { attention } from '@/lib/engine/attention'
import { ageLabel, money } from '@/lib/format'
import { getPrograms, getRecords, sharedParties, toContexts } from '@/lib/queries'
import { owningRole } from '@/lib/engine/runtime'
import { ROLE_LABELS, stateLabel } from '@/lib/spec/types'
import { cn } from '@/lib/utils'

export default async function RecordsPage({ searchParams }: PageProps<'/records'>) {
  const params = await searchParams
  const programFilter = typeof params.program === 'string' ? params.program : null
  const stateFilter = typeof params.state === 'string' ? params.state : null
  const onlyFlagged = params.flagged === '1'

  const [programs, records] = await Promise.all([getPrograms(), getRecords()])
  const now = new Date()
  const items = attention(toContexts(programs), records, now)
  const shared = sharedParties(programs, records)

  const flaggedIds = new Set(items.map((i) => i.recordId).filter(Boolean) as string[])

  let visible = records
  if (programFilter) visible = visible.filter((r) => r.programId === programFilter)
  if (stateFilter) visible = visible.filter((r) => r.state === stateFilter)
  if (onlyFlagged) visible = visible.filter((r) => flaggedIds.has(r.id))

  const states = [...new Set(records.map((r) => r.state))].sort()

  const tabs: Tab[] = [
    {
      key: 'all',
      label: 'All',
      href: '/records',
      active: !programFilter && !stateFilter && !onlyFlagged,
    },
    ...programs.map((p) => ({
      key: p.id,
      label: p.name,
      href: `/records?program=${p.id}`,
      active: programFilter === p.id,
      tone: 'brand' as const,
    })),
    ...states.map((s) => ({
      key: s,
      label: stateLabel(s),
      href: `/records?state=${s}`,
      active: stateFilter === s,
    })),
    {
      key: 'flagged',
      label: 'Needs attention',
      count: flaggedIds.size,
      href: '/records?flagged=1',
      active: onlyFlagged,
      tone: 'overdue' as const,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeading
        icon={<ListChecksIcon size={30} />}
        title="Records"
        back={{ href: '/', label: 'To Review' }}
        meta={`${visible.length} of ${records.length} across ${
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
                const flags = items.filter((i) => i.recordId === record.id)
                const isShared = shared.has(title)

                return (
                  <TableRow key={record.id} className="group">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <Link href={`/records/${record.id}`} className="hover:underline">
                        {record.ref}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/records/${record.id}`} className="hover:underline">
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
    </div>
  )
}
