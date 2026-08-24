import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileTextIcon } from '@phosphor-icons/react/dist/ssr'
import { PageHeading } from '@/components/page-heading'
import { migrateRecord, performTransition } from '@/app/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { FieldEditor } from '@/components/field-editor'
import { Provenance } from '@/components/provenance'
import { StateChip } from '@/components/state-chip'
import { attention } from '@/lib/engine/attention'
import { availableTransitions, missingRequiredFields, unmetRules } from '@/lib/engine/runtime'
import { dateTime, displayValue, money, shortDate } from '@/lib/format'
import { provenanceFor } from '@/lib/provenance'
import {
  getEvents,
  getPrograms,
  getRecord,
  getRecords,
  sharedParties,
  toContexts,
} from '@/lib/queries'
import { currentRole } from '@/lib/roles'
import { describe } from '@/lib/spec/expr'
import { ROLE_LABELS, ROLE_PEOPLE, stateLabel } from '@/lib/spec/types'

export default async function RecordPage({ params, searchParams }: PageProps<'/grants/[id]'>) {
  const { id } = await params
  const query = await searchParams
  const error = typeof query.error === 'string' ? query.error : null

  const [role, record, programs, allRecords] = await Promise.all([
    currentRole(),
    getRecord(id),
    getPrograms(),
    getRecords(),
  ])
  if (!record) notFound()

  const program = programs.find((p) => p.id === record.programId)
  if (!program) notFound()

  // The spec this record is being run under, which may be behind the program's.
  const spec = program.versions.find((v) => v.version === record.specVersion)?.spec
  if (!spec) notFound()

  const events = await getEvents(record.id)
  const now = new Date()
  const items = attention(toContexts(programs), allRecords, now).filter(
    (i) => i.recordId === record.id,
  )

  const titleKey = spec.fields.find((f) => f.type === 'text')?.key
  const title = titleKey ? String(record.data[titleKey] ?? record.ref) : record.ref
  const shared = sharedParties(programs, allRecords)
  const alsoIn = (shared.get(title) ?? []).filter((pid) => pid !== program.id)

  const actions = availableTransitions(spec, record, role)
  const blockers = [
    ...unmetRules(spec, record).map(
      (r) => `${r.label} — needs ${r.require.map((k) => spec.fields.find((f) => f.key === k)?.label ?? k).join(', ')}`,
    ),
    ...missingRequiredFields(spec, record).map((f) => `${f.label} is empty`),
  ]
  const behind = record.specVersion < program.currentVersion

  return (
    <div className="space-y-8">
      <PageHeading
        icon={<FileTextIcon size={30} />}
        title={title}
        back={{ href: '/grants', label: 'Grants' }}
        aside={<StateChip state={record.state} className="text-sm" />}
        meta={
          <>
            <span className="font-mono">{record.ref}</span> ·{' '}
            <Link
              href={`/programs/${program.id}`}
              className="text-link underline-offset-4 hover:underline"
            >
              {program.name}
            </Link>{' '}
            · spec v{record.specVersion}
          </>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>That action did not go through</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {items.length > 0 ? (
        <Alert>
          <AlertTitle>
            {items.length === 1 ? items[0].reason : `${items.length} things need attention`}
          </AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {items.map((i) => (
                <li key={i.id}>
                  {i.subline}
                  {i.ownerRole ? ` — ${ROLE_PEOPLE[i.ownerRole]}` : ''}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {behind ? (
        <Alert>
          <AlertTitle>
            This record is on v{record.specVersion}; the program is on v
            {program.currentVersion}
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>
              It is still judged by the rules that were in force when the work started.
              Moving it forward is a decision, not something the system should do quietly.
            </span>
            <form action={migrateRecord}>
              <input type="hidden" name="recordId" value={record.id} />
              <Button type="submit" size="sm" variant="outline">
                Move to v{program.currentVersion}
              </Button>
            </form>
          </AlertDescription>
        </Alert>
      ) : null}

      {alsoIn.length > 0 ? (
        <Alert>
          <AlertTitle>{title} appears in more than one program</AlertTitle>
          <AlertDescription>
            Also in{' '}
            {alsoIn
              .map((pid) => programs.find((p) => p.id === pid)?.name ?? 'another program')
              .join(', ')}
            . This app flags the overlap; it does not try to reconcile the two.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-tight">Details</h2>
            <dl className="divide-y overflow-hidden rounded-2xl border bg-card">
              {spec.fields.map((field) => (
                <div
                  key={field.key}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
                >
                  <dt className="flex w-48 shrink-0 items-center gap-2 text-sm text-muted-foreground">
                    {field.label}
                    {field.source ? (
                      <Provenance
                        info={provenanceFor(
                          program,
                          'field',
                          field.key,
                          `${field.label} is recorded against every ${program.entity.toLowerCase()}.`,
                        )}
                      />
                    ) : null}
                  </dt>
                  <dd className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <span
                      className={
                        record.data[field.key] === null || record.data[field.key] === undefined
                          ? 'text-sm text-muted-foreground'
                          : 'text-sm'
                      }
                    >
                      {displayValue(record.data[field.key], field.type)}
                    </span>
                    <FieldEditor
                      recordId={record.id}
                      fieldKey={field.key}
                      label={field.label}
                      type={field.type}
                      value={record.data[field.key]}
                      role={role}
                      lockedReason={signatureLock(spec, field.key, role)}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-tight">
              What {ROLE_LABELS[role]} can do
            </h2>
            {actions.length === 0 ? (
              <p className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                Nothing here belongs to {ROLE_LABELS[role]} while this record is in{' '}
                {stateLabel(record.state).toLowerCase()}. Switch role in the header to see
                the same record from somebody else&apos;s queue.
              </p>
            ) : (
              <div className="space-y-3 rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap gap-2">
                  {actions.map(({ transition, enabled }) => (
                    <form key={transition.id} action={performTransition}>
                      <input type="hidden" name="recordId" value={record.id} />
                      <input type="hidden" name="transitionId" value={transition.id} />
                      <Button type="submit" size="sm" disabled={!enabled}>
                        {transition.label}
                      </Button>
                    </form>
                  ))}
                </div>
                {blockers.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Blocked by {blockers.join('; ')}.
                  </p>
                ) : null}
                {actions[0]?.transition.source ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>These actions exist because of</span>
                    {actions.map(({ transition }) =>
                      transition.source ? (
                        <Provenance
                          key={transition.id}
                          info={provenanceFor(
                            program,
                            'transition',
                            transition.id,
                            `${transition.label}: moves ${program.entity.toLowerCase()}s from ${stateLabel(transition.from).toLowerCase()} to ${stateLabel(transition.to).toLowerCase()}, and belongs to ${ROLE_LABELS[transition.role]}.`,
                          )}
                          label={`${transition.label} ${transition.source.clause}`}
                        />
                      ) : null,
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-tight">History</h2>
            <ol className="divide-y overflow-hidden rounded-2xl border bg-card">
              {events.map((event) => (
                <li key={event.id} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="w-40 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {dateTime(event.at)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{event.actor}</span>{' '}
                    <span className="text-muted-foreground">{describeEvent(event)}</span>
                  </span>
                </li>
              ))}
              {events.length === 0 ? (
                <li className="px-4 py-6 text-sm text-muted-foreground">
                  Nothing has happened to this record yet.
                </li>
              ) : null}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-semibold tracking-tight">Rules in force</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              As of spec v{record.specVersion}.
            </p>
            <ul className="mt-3 space-y-3">
              {spec.rules.map((rule) => {
                const binding = unmetRules(spec, record).some((r) => r.id === rule.id)
                return (
                  <li key={rule.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rule.label}</span>
                      {binding ? (
                        <Badge variant="outline" className="text-[11px]">
                          Not met
                        </Badge>
                      ) : null}
                      {rule.source ? (
                        <Provenance
                          info={provenanceFor(
                            program,
                            'rule',
                            rule.id,
                            `When ${describe(rule.when, spec)}, ${rule.require
                              .map((k) => spec.fields.find((f) => f.key === k)?.label ?? k)
                              .join(' and ')} is required.`,
                          )}
                        />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      When {describe(rule.when, spec)}
                    </p>
                  </li>
                )
              })}
              {spec.rules.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  No rules yet. Upload the contract that governs this program.
                </li>
              ) : null}
            </ul>

            {spec.clocks.length > 0 ? (
              <>
                <Separator className="my-4" />
                <h3 className="text-sm font-semibold tracking-tight">Clocks</h3>
                <ul className="mt-3 space-y-3">
                  {spec.clocks.map((clock) => (
                    <li key={clock.id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{clock.label}</span>
                        {clock.source ? (
                          <Provenance
                            info={provenanceFor(
                              program,
                              'clock',
                              clock.id,
                              `${clock.days} days from entering ${stateLabel(clock.fromState).toLowerCase()}, escalating to ${ROLE_LABELS[clock.ownerRole]} after ${clock.warnAt}.`,
                            )}
                          />
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {clock.days} days from {stateLabel(clock.fromState).toLowerCase()}
                        {clock.fromState === record.state
                          ? ` · started ${shortDate(record.stateEnteredAt)}`
                          : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section className="rounded-2xl border bg-card p-4 text-sm">
            <h2 className="text-sm font-semibold tracking-tight">Summary</h2>
            <dl className="mt-3 space-y-2">
              <Row label="Created" value={shortDate(record.createdAt)} />
              <Row label="In this state since" value={shortDate(record.stateEnteredAt)} />
              <Row label="Last updated" value={shortDate(record.updatedAt)} />
              {spec.fields.find((f) => f.type === 'money') ? (
                <Row
                  label="Amount"
                  value={money(record.data[spec.fields.find((f) => f.type === 'money')!.key])}
                />
              ) : null}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function describeEvent(event: {
  type: string
  payload: Record<string, unknown>
}): string {
  const p = event.payload
  switch (event.type) {
    case 'created':
      return `created this grant${p.source ? ` from ${p.source}` : ''}`
    case 'transition':
      return `${p.label ?? 'moved it'} — ${stateLabel(String(p.from ?? ''))} → ${stateLabel(String(p.to ?? ''))}${p.clause ? ` (${p.clause})` : ''}`
    case 'clock_started':
      return `started the ${p.clock} clock, ${p.days} days${p.clause ? ` (${p.clause})` : ''}`
    case 'signature_requested':
      return `requested a signature from ${p.from}${p.clause ? ` (${p.clause})` : ''}`
    case 'signed':
      return `signed ${p.key}`
    case 'field_updated':
      return `set ${p.key}`
    case 'spec_applied':
      return `applied spec v${p.version}${p.document ? ` from ${p.document}` : ''}`
    case 'migrated':
      return `moved this grant from v${p.from} to v${p.to}`
    default:
      return event.type.replace(/_/g, ' ')
  }
}

/**
 * Who is allowed to satisfy a signature requirement.
 *
 * The contract says the counter-signature may not come from the person who
 * approved the award, so a signature field is only actionable by the role the
 * rule names. Everyone else is told whose it is, not handed a dead button.
 */
function signatureLock(
  spec: { rules: { require: string[]; role: string | null }[] },
  fieldKey: string,
  role: string,
): string | null {
  const rule = spec.rules.find((r) => r.require.includes(fieldKey) && r.role)
  if (!rule?.role || rule.role === role) return null
  return `${ROLE_LABELS[rule.role as keyof typeof ROLE_LABELS]} signs this`
}
