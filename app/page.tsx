import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UploadDialog } from '@/components/upload-dialog'
import { attention, URGENCY_LABELS, type AttentionItem, type Urgency } from '@/lib/engine/attention'
import { money } from '@/lib/format'
import { getPendingDeltas, getPrograms, getRecords, toContexts } from '@/lib/queries'
import { currentRole } from '@/lib/roles'
import { ROLE_LABELS, ROLE_PEOPLE } from '@/lib/spec/types'
import { SAMPLE_OPTIONS } from '@/lib/samples'
import { cn } from '@/lib/utils'

const GROUPS: Urgency[] = ['overdue', 'due_soon', 'blocked', 'change']

const REASON_TONE: Record<string, string> = {
  'Clock breach': 'border-red-600/25 bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300',
  'Clock warning': 'border-amber-600/25 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  'Awaiting approval': 'border-violet-600/25 bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200',
  'Missing information': 'border-slate-600/25 bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200',
  'Change impact': 'border-sky-600/25 bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
}

export default async function InboxPage({ searchParams }: PageProps<'/'>) {
  const params = await searchParams
  const error = typeof params.error === 'string' ? params.error : null

  const [role, programs, records, pending] = await Promise.all([
    currentRole(),
    getPrograms(),
    getRecords(),
    getPendingDeltas(),
  ])

  const all = attention(toContexts(programs), records, new Date())
  // An item with no owner is everyone's problem; an owned one belongs to its role.
  const mine = all.filter((i) => i.ownerRole === null || i.ownerRole === role)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mine.length === 0
              ? `Nothing needs ${ROLE_PEOPLE[role]} right now.`
              : `${mine.length} ${mine.length === 1 ? 'thing needs' : 'things need'} ${ROLE_PEOPLE[role]}, ${ROLE_LABELS[role]}.`}
          </p>
        </div>
        {all.length !== mine.length ? (
          <p className="text-sm text-muted-foreground">
            {all.length - mine.length} more with other roles
          </p>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>That did not work</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {pending.length > 0 ? (
        <Alert>
          <AlertTitle>
            {pending.length === 1
              ? 'A document is waiting for review'
              : `${pending.length} documents are waiting for review`}
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Nothing it proposes takes effect until somebody approves it.</span>
            <Button
              size="sm"
              variant="outline"
              render={<Link href={`/review/${pending[0].id}`} />}
            >
              Review changes
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {mine.length === 0 ? (
        <EmptyInbox programs={programs} />
      ) : (
        <div className="space-y-8">
          {GROUPS.map((group) => {
            const items = mine.filter((i) => i.urgency === group)
            if (items.length === 0) return null
            return (
              <section key={group}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight">
                  {URGENCY_LABELS[group]}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                </h2>
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                  {items.map((item) => (
                    <ItemRow key={item.id} item={item} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item }: { item: AttentionItem }) {
  const body = (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-accent/50">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn('text-[11px] font-medium', REASON_TONE[item.reason])}
          >
            {item.reason}
          </Badge>
          <span className="truncate text-sm font-medium">{item.headline}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{item.subline}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.programName}
          {item.recordRef ? ` · ${item.recordRef}` : ''}
          {item.ownerRole ? ` · ${ROLE_PEOPLE[item.ownerRole]}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {item.amount !== null ? (
          <span className="text-sm font-medium tabular-nums">{money(item.amount)}</span>
        ) : null}
        <span
          className={cn(
            'text-xs font-medium tabular-nums',
            item.urgency === 'overdue' ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground',
          )}
        >
          {item.ageLabel}
        </span>
      </div>
    </div>
  )

  return (
    <li>
      {item.recordId ? (
        <Link href={`/records/${item.recordId}`} className="block">
          {body}
        </Link>
      ) : (
        <Link href={`/programs/${item.programId}`} className="block">
          {body}
        </Link>
      )}
    </li>
  )
}

function EmptyInbox({
  programs,
}: {
  programs: { id: string; name: string; currentVersion: number }[]
}) {
  const empty = programs.length === 0
  return (
    <div className="rounded-xl border border-dashed px-6 py-16 text-center">
      <h2 className="text-lg font-medium">
        {empty ? 'No programs yet' : 'Nothing needs your attention'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {empty
          ? 'Upload a spreadsheet to get a working app, then upload the contract that governs it.'
          : 'When a clock runs down, an approval stalls, or a document changes the rules, it shows up here.'}
      </p>
      <div className="mt-6 flex justify-center">
        <UploadDialog
          programs={programs.map((p) => ({
            id: p.id,
            name: p.name,
            version: p.currentVersion,
          }))}
          samples={SAMPLE_OPTIONS}
        />
      </div>
    </div>
  )
}
