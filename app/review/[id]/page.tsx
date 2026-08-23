import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GitDiffIcon } from '@phosphor-icons/react/dist/ssr'
import { PageHeading } from '@/components/page-heading'
import { approveDelta, discardDelta } from '@/app/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { applyOps, currentElement, opKind, opTarget, type DeltaOp } from '@/lib/spec/delta'
import { evaluate, describe } from '@/lib/spec/expr'
import { dateTime, money } from '@/lib/format'
import { getDelta, getDocument, getPrograms, getRecords } from '@/lib/queries'
import type { RecordRow } from '@/lib/queries'
import { ROLE_LABELS, stateLabel, type Clock, type Rule, type Spec } from '@/lib/spec/types'
import { cn } from '@/lib/utils'

export default async function ReviewPage({ params }: PageProps<'/review/[id]'>) {
  const { id } = await params
  const delta = await getDelta(id)
  if (!delta) notFound()

  const [document, programs, records] = await Promise.all([
    getDocument(delta.documentId),
    getPrograms(),
    getRecords(),
  ])
  const program = delta.programId ? programs.find((p) => p.id === delta.programId) : null
  const baseSpec = program?.currentSpec ?? null
  const ops = delta.ops as DeltaOp[]
  const changes = ops.filter((o) => o.op !== 'unresolved')
  const unresolved = ops.filter((o) => o.op === 'unresolved')

  const mine = program ? records.filter((r) => r.programId === program.id) : []
  const nextSpec = baseSpec ? applyOps(baseSpec, changes) : null

  if (delta.status !== 'pending') {
    return (
      <Alert>
        <AlertTitle>This review is already {delta.status}</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>
            {delta.decidedBy ? `${delta.decidedBy} decided it` : 'It was decided'}
            {delta.decidedAt ? ` on ${dateTime(delta.decidedAt)}` : ''}.
          </span>
          <Button size="sm" variant="outline" render={<Link href="/" />}>
            Back to the Inbox
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeading
        icon={<GitDiffIcon size={30} />}
        title={document?.name ?? 'Document'}
        back={{ href: '/', label: 'To Review' }}
        meta={`${changes.length} proposed ${changes.length === 1 ? 'change' : 'changes'}${
          unresolved.length > 0
            ? ` and ${unresolved.length} unresolved ${unresolved.length === 1 ? 'clause' : 'clauses'}`
            : ''
        }${
          program
            ? ` against ${program.name} v${program.currentVersion}`
            : ' — this would create a new program'
        }${delta.extractedBy === 'cached' ? ' · read from a cached extraction' : ''}`}
        aside={
          <form action={discardDelta}>
            <input type="hidden" name="deltaId" value={delta.id} />
            <Button type="submit" variant="ghost" size="sm">
              Discard
            </Button>
          </form>
        }
      />

      <Alert>
        <AlertTitle>Nothing here has been applied</AlertTitle>
        <AlertDescription>
          This document was read as a set of typed operations, each citing the clause it
          came from. The model cannot write anything that is not one of these shapes, and
          nothing takes effect until you approve it below.
        </AlertDescription>
      </Alert>

      <form action={approveDelta} className="space-y-6">
        <input type="hidden" name="deltaId" value={delta.id} />

        <div className="space-y-4">
          {changes.map((op) => {
            const index = ops.indexOf(op)
            const target = opTarget(op)
            const before = baseSpec ? currentElement(baseSpec, op) : null
            return (
              <article key={index} className="overflow-hidden rounded-2xl border bg-card">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      name="op"
                      value={index}
                      defaultChecked
                      className="size-4 accent-foreground"
                    />
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[11px]',
                        opKind(op) === 'Modified' &&
                          'border-amber-600/25 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
                      )}
                    >
                      {opKind(op)}
                    </Badge>
                  </label>
                  <span className="text-sm font-medium">{target.label}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {target.kind}
                  </span>
                </header>

                <div className="space-y-4 px-4 py-4">
                  <p className="text-sm">{op.summary}</p>

                  {before ? (
                    <SideBySide
                      before={before}
                      after={op}
                      baseSpec={baseSpec!}
                      nextSpec={nextSpec!}
                    />
                  ) : (
                    <Detail op={op} spec={nextSpec ?? baseSpec} />
                  )}

                  {nextSpec && baseSpec ? (
                    <Impact op={op} baseSpec={baseSpec} nextSpec={nextSpec} records={mine} />
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>

        {unresolved.length > 0 ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-tight">
              Unresolved — recorded, not guessed
            </h2>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {unresolved.map((op) => {
                const index = ops.indexOf(op)
                if (op.op !== 'unresolved') return null
                return (
                  <li key={index} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          name="op"
                          value={index}
                          defaultChecked
                          className="size-4 accent-foreground"
                        />
                        <Badge variant="outline" className="text-[11px]">
                          Unresolved
                        </Badge>
                      </label>
                      <span className="text-sm">{op.summary}</span>
                    </div>
                    <blockquote className="mt-2 border-l-2 pl-3 text-xs text-muted-foreground italic">
                      {op.item.source.quote}
                    </blockquote>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {op.item.source.document} {op.item.source.clause}
                    </p>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Keeping these records the ambiguity on the program page. It does not create a
              rule, and it does not block anything.
            </p>
          </section>
        ) : null}

        {ops.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            Nothing in this document changes the program.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3 border-t pt-6">
            <Button type="submit">
              {program
                ? `Approve and create v${program.currentVersion + 1}`
                : 'Approve and create the program'}
            </Button>
            <span className="text-sm text-muted-foreground">
              Records already in flight stay on their current version.
            </span>
          </div>
        )}
      </form>
    </div>
  )
}

/**
 * The conflict UI. Matching on id is all the detection this needs: if an
 * operation names an element the program already has, the reviewer sees the old
 * clause and the new one next to each other and decides.
 */
function SideBySide({
  before,
  after,
  baseSpec,
  nextSpec,
}: {
  before: unknown
  after: DeltaOp
  baseSpec: Spec
  nextSpec: Spec
}) {
  const rows = compareRows(before, after, baseSpec, nextSpec)
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium"> </th>
            <th className="px-3 py-2 text-left font-medium">Current</th>
            <th className="px-3 py-2 text-left font-medium">Proposed</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.label} className={row.changed ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
              <td className="px-3 py-2 align-top text-muted-foreground">{row.label}</td>
              <td className="px-3 py-2 align-top">{row.before}</td>
              <td className={cn('px-3 py-2 align-top', row.changed && 'font-medium')}>
                {row.after}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type CompareRow = { label: string; before: string; after: string; changed: boolean }

function compareRows(
  before: unknown,
  op: DeltaOp,
  baseSpec: Spec,
  nextSpec: Spec,
): CompareRow[] {
  const rows: CompareRow[] = []
  const add = (label: string, b: string, a: string) =>
    rows.push({ label, before: b, after: a, changed: b !== a })

  if (op.op === 'modify_rule') {
    const b = before as Rule
    add('When', describe(b.when, baseSpec), describe(op.rule.when, nextSpec))
    add(
      'Requires',
      b.require.map((k) => label(baseSpec, k)).join(', '),
      op.rule.require.map((k) => label(nextSpec, k)).join(', '),
    )
    add('Owned by', b.role ? ROLE_LABELS[b.role] : 'Any role', op.rule.role ? ROLE_LABELS[op.rule.role] : 'Any role')
    add('Source', cite(b.source), cite(op.rule.source))
    add('Clause text', b.source?.quote ?? '—', op.rule.source?.quote ?? '—')
  } else if (op.op === 'modify_clock') {
    const b = before as Clock
    add('Days', String(b.days), String(op.clock.days))
    add('Escalates after', String(b.warnAt), String(op.clock.warnAt))
    add('Starts on', stateLabel(b.fromState), stateLabel(op.clock.fromState))
    add('Owned by', ROLE_LABELS[b.ownerRole], ROLE_LABELS[op.clock.ownerRole])
    add('Source', cite(b.source), cite(op.clock.source))
    add('Clause text', b.source?.quote ?? '—', op.clock.source?.quote ?? '—')
  } else if (op.op === 'modify_field') {
    const b = before as Spec['fields'][number]
    add('Label', b.label, op.field.label)
    add('Type', b.type, op.field.type)
    add('Required', b.required ? 'Yes' : 'No', op.field.required ? 'Yes' : 'No')
    add('Source', cite(b.source), cite(op.field.source))
  } else if (op.op === 'modify_transition') {
    const b = before as Spec['transitions'][number]
    add('Label', b.label, op.transition.label)
    add('Moves', `${stateLabel(b.from)} → ${stateLabel(b.to)}`, `${stateLabel(op.transition.from)} → ${stateLabel(op.transition.to)}`)
    add('Owned by', ROLE_LABELS[b.role], ROLE_LABELS[op.transition.role])
    add('Only when', describe(b.guard, baseSpec), describe(op.transition.guard, nextSpec))
    add('Source', cite(b.source), cite(op.transition.source))
  }
  return rows
}

function cite(source: { document: string; clause: string } | null | undefined): string {
  return source ? `${source.document} ${source.clause}` : '—'
}

function label(spec: Spec, key: string): string {
  return spec.fields.find((f) => f.key === key)?.label ?? key
}

function Detail({ op, spec }: { op: DeltaOp; spec: Spec | null }) {
  if (!spec) return null
  const line = (k: string, v: string) => (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-muted-foreground">{k}</dt>
      <dd>{v}</dd>
    </div>
  )
  return (
    <dl className="space-y-1 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
      {op.op === 'add_rule'
        ? [
            line('When', describe(op.rule.when, spec)),
            line('Requires', op.rule.require.map((k) => label(spec, k)).join(', ')),
            line('Owned by', op.rule.role ? ROLE_LABELS[op.rule.role] : 'Any role'),
            line('Source', cite(op.rule.source)),
          ]
        : null}
      {op.op === 'add_clock'
        ? [
            line('Window', `${op.clock.days} days from ${stateLabel(op.clock.fromState).toLowerCase()}`),
            line('Escalates after', `${op.clock.warnAt} days`),
            line('Owned by', ROLE_LABELS[op.clock.ownerRole]),
            line('Source', cite(op.clock.source)),
          ]
        : null}
      {op.op === 'add_field'
        ? [
            line('Type', op.field.type),
            line('Required', op.field.required ? 'Yes' : 'No'),
            line('Source', cite(op.field.source)),
          ]
        : null}
      {op.op === 'add_transition'
        ? [
            line('Moves', `${stateLabel(op.transition.from)} → ${stateLabel(op.transition.to)}`),
            line('Owned by', ROLE_LABELS[op.transition.role]),
            line('Only when', describe(op.transition.guard, spec)),
            line('Source', cite(op.transition.source)),
          ]
        : null}
      {op.op === 'add_state' ? line('New state', stateLabel(op.state)) : null}
    </dl>
  )
}

/**
 * What this one operation would do to work already in flight.
 *
 * This is the sentence that makes an amendment concrete: not "the threshold
 * changed" but "these two awards now need a signature they do not have".
 */
function Impact({
  op,
  baseSpec,
  nextSpec,
  records,
}: {
  op: DeltaOp
  baseSpec: Spec
  nextSpec: Spec
  records: RecordRow[]
}) {
  const now = new Date()
  const DAY = 24 * 60 * 60 * 1000
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const daysIn = (d: Date) => Math.round((day(now) - day(d)) / DAY)

  let affected: RecordRow[] = []
  let sentence = ''

  if (op.op === 'modify_rule' || op.op === 'add_rule') {
    const old = baseSpec.rules.find((r) => r.id === op.rule.id)
    affected = records.filter((r) => {
      const boundBefore = old ? evaluate(old.when, r.data) : false
      const boundNow = evaluate(op.rule.when, r.data)
      const satisfied = op.rule.require.every((k) => {
        const v = r.data[k]
        return v !== null && v !== undefined && v !== '' && v !== false
      })
      return boundNow && !boundBefore && !satisfied
    })
    sentence = `would newly require ${op.rule.require.map((k) => label(nextSpec, k)).join(' and ')}`
  } else if (op.op === 'modify_clock') {
    const old = baseSpec.clocks.find((c) => c.id === op.clock.id)
    if (old) {
      affected = records.filter((r) => {
        if (r.state !== op.clock.fromState) return false
        const elapsed = daysIn(r.stateEnteredAt)
        return elapsed > op.clock.days && elapsed <= old.days
      })
      sentence = `would become overdue immediately under the ${op.clock.days}-day window`
    }
  }

  if (affected.length === 0) return null

  const amountKey = nextSpec.fields.find((f) => f.type === 'money')?.key
  const titleKey = nextSpec.fields.find((f) => f.type === 'text')?.key

  return (
    <div className="rounded-lg border border-amber-600/25 bg-amber-50/60 px-3 py-2.5 text-sm dark:bg-amber-950/20">
      <p className="font-medium">
        {affected.length} in-flight {affected.length === 1 ? 'record' : 'records'} {sentence}.
      </p>
      <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
        {affected.map((r) => (
          <li key={r.id}>
            <Link href={`/records/${r.id}`} className="underline-offset-4 hover:underline">
              {titleKey ? String(r.data[titleKey]) : r.ref}
            </Link>
            {amountKey ? ` — ${money(r.data[amountKey])}` : ''}
            {' · '}
            {r.ref}
          </li>
        ))}
      </ul>
    </div>
  )
}
