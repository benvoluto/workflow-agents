import Link from 'next/link'
import { notFound } from 'next/navigation'
import { migrateProgram } from '@/app/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Provenance } from '@/components/provenance'
import { StateChip } from '@/components/state-chip'
import { dateTime } from '@/lib/format'
import { provenanceFor } from '@/lib/provenance'
import { getPendingDeltas, getPrograms, getRecords } from '@/lib/queries'
import { describe } from '@/lib/spec/expr'
import { ROLE_LABELS, stateLabel } from '@/lib/spec/types'

export default async function ProgramPage({ params, searchParams }: PageProps<'/programs/[id]'>) {
  const { id } = await params
  const query = await searchParams

  const [programs, records, pending] = await Promise.all([
    getPrograms(),
    getRecords(),
    getPendingDeltas(),
  ])
  const program = programs.find((p) => p.id === id)
  if (!program?.currentSpec) notFound()

  const spec = program.currentSpec
  const mine = records.filter((r) => r.programId === program.id)
  const behind = mine.filter((r) => r.specVersion < program.currentVersion)
  const pendingHere = pending.filter((d) => d.programId === program.id)

  const applied = typeof query.applied === 'string' ? query.applied : null
  const imported = query.imported === '1'
  const migrated = typeof query.migrated === 'string' ? query.migrated : null

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/programs"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Programs
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{program.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Version {program.currentVersion} · {mine.length}{' '}
              {mine.length === 1
                ? program.entity.toLowerCase()
                : `${program.entity.toLowerCase()}s`}{' '}
              ·{' '}
              <Link
                href={`/records?program=${program.id}`}
                className="underline-offset-4 hover:underline"
              >
                view records
              </Link>
            </p>
          </div>
          <Badge variant="outline">v{program.currentVersion}</Badge>
        </div>
      </div>

      {applied ? (
        <Alert>
          <AlertTitle>{program.name} is now v{applied}</AlertTitle>
          <AlertDescription>
            {behind.length > 0
              ? `${behind.length} in-flight ${behind.length === 1 ? 'record is' : 'records are'} still on an older version. The Inbox lists what would change for them.`
              : 'Every record is already on this version.'}
          </AlertDescription>
        </Alert>
      ) : null}

      {imported ? (
        <Alert>
          <AlertTitle>Records imported</AlertTitle>
          <AlertDescription>
            {mine.length} {mine.length === 1 ? 'record' : 'records'} created from the
            spreadsheet. Upload the contract that governs them to give the program real
            rules.
          </AlertDescription>
        </Alert>
      ) : null}

      {migrated ? (
        <Alert>
          <AlertTitle>
            {migrated} {migrated === '1' ? 'record' : 'records'} moved to v
            {program.currentVersion}
          </AlertTitle>
          <AlertDescription>
            They are now judged by the current rules, and each one has an entry in its
            history saying so.
          </AlertDescription>
        </Alert>
      ) : null}

      {pendingHere.length > 0 ? (
        <Alert>
          <AlertTitle>A document is waiting for review</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Nothing it proposes has been applied.</span>
            <Button
              size="sm"
              variant="outline"
              render={<Link href={`/review/${pendingHere[0].id}`} />}
            >
              Review changes
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {behind.length > 0 ? (
        <Alert>
          <AlertTitle>
            {behind.length} {behind.length === 1 ? 'record is' : 'records are'} on an older
            version
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>
              They keep the rules that applied when their work started until somebody
              decides otherwise.
            </span>
            <form action={migrateProgram}>
              <input type="hidden" name="programId" value={program.id} />
              <Button type="submit" size="sm" variant="outline">
                Move all {behind.length} to v{program.currentVersion}
              </Button>
            </form>
          </AlertDescription>
        </Alert>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Lifecycle</h2>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-4">
          {spec.states.map((state, i) => (
            <span key={state} className="flex items-center gap-2">
              <StateChip state={state} />
              {i < spec.states.length - 1 ? (
                <span className="text-muted-foreground">→</span>
              ) : null}
            </span>
          ))}
          {spec.states.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              No lifecycle yet. A contract will give it one.
            </span>
          ) : null}
        </div>
      </section>

      <Section title="Transitions" empty="No transitions yet.">
        {spec.transitions.map((t) => (
          <Row
            key={t.id}
            title={t.label}
            meta={`${stateLabel(t.from)} → ${stateLabel(t.to)} · ${ROLE_LABELS[t.role]}`}
            detail={t.guard ? `Only when ${describe(t.guard, spec)}` : null}
            provenance={
              <Provenance
                info={provenanceFor(
                  program,
                  'transition',
                  t.id,
                  `${t.label}: moves ${program.entity.toLowerCase()}s from ${stateLabel(t.from).toLowerCase()} to ${stateLabel(t.to).toLowerCase()}, and belongs to ${ROLE_LABELS[t.role]}.`,
                )}
              />
            }
          />
        ))}
      </Section>

      <Section title="Rules" empty="No rules yet. Upload the contract that governs this program.">
        {spec.rules.map((r) => (
          <Row
            key={r.id}
            title={r.label}
            meta={r.role ? ROLE_LABELS[r.role] : 'Any role'}
            detail={`When ${describe(r.when, spec)}, requires ${r.require
              .map((k) => spec.fields.find((f) => f.key === k)?.label ?? k)
              .join(' and ')}.`}
            provenance={
              <Provenance
                info={provenanceFor(
                  program,
                  'rule',
                  r.id,
                  `When ${describe(r.when, spec)}, ${r.require
                    .map((k) => spec.fields.find((f) => f.key === k)?.label ?? k)
                    .join(' and ')} is required.`,
                )}
              />
            }
          />
        ))}
      </Section>

      <Section title="Clocks" empty="No clocks yet.">
        {spec.clocks.map((c) => (
          <Row
            key={c.id}
            title={c.label}
            meta={`${ROLE_LABELS[c.ownerRole]}`}
            detail={`${c.days} days from entering ${stateLabel(c.fromState).toLowerCase()}, escalating after ${c.warnAt}.`}
            provenance={
              <Provenance
                info={provenanceFor(
                  program,
                  'clock',
                  c.id,
                  `${c.days} days from entering ${stateLabel(c.fromState).toLowerCase()}, escalating to ${ROLE_LABELS[c.ownerRole]} after ${c.warnAt}.`,
                )}
              />
            }
          />
        ))}
      </Section>

      <Section title="Fields" empty="No fields yet.">
        {spec.fields.map((f) => (
          <Row
            key={f.key}
            title={f.label}
            meta={`${f.type}${f.required ? ' · required' : ''}${f.requiredFrom ? ` from ${stateLabel(f.requiredFrom).toLowerCase()}` : ''}`}
            detail={null}
            provenance={
              f.source ? (
                <Provenance
                  info={provenanceFor(
                    program,
                    'field',
                    f.key,
                    `${f.label} is recorded against every ${program.entity.toLowerCase()}.`,
                  )}
                />
              ) : (
                <span className="font-mono text-[11px] text-muted-foreground">
                  from spreadsheet
                </span>
              )
            }
          />
        ))}
      </Section>

      {spec.unresolved.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-tight">
            Unresolved clauses
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            The extractor found these but could not turn them into a rule without
            guessing. They are recorded rather than invented.
          </p>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {spec.unresolved.map((u) => (
              <li key={u.id} className="px-4 py-3">
                <p className="text-sm font-medium">{u.summary}</p>
                <blockquote className="mt-1 border-l-2 pl-3 text-xs text-muted-foreground italic">
                  {u.source.quote}
                </blockquote>
                <p className="mt-1 text-xs text-muted-foreground">
                  {u.source.document} {u.source.clause}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Version history</h2>
        <ol className="divide-y overflow-hidden rounded-xl border bg-card">
          {[...program.versions].reverse().map((v) => (
            <li key={v.version} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3">
              <span className="w-16 shrink-0 text-sm font-medium">v{v.version}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{v.summary ?? 'No summary recorded.'}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {v.approvedBy ? `Approved by ${v.approvedBy}` : 'Not approved by anyone'} ·{' '}
                  {dateTime(v.createdAt)}
                  {v.sourceDocumentId ? (
                    <>
                      {' · '}
                      <Link
                        href={`/documents/${v.sourceDocumentId}`}
                        className="underline underline-offset-4"
                      >
                        source document
                      </Link>
                    </>
                  ) : null}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function Section({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: React.ReactNode
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  const isEmpty = Array.isArray(items) && items.length === 0
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-tight">{title}</h2>
      {isEmpty ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">{items}</ul>
      )}
    </section>
  )
}

function Row({
  title,
  meta,
  detail,
  provenance,
}: {
  title: string
  meta: string
  detail: string | null
  provenance: React.ReactNode
}) {
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground capitalize">{meta}</span>
        </div>
        {detail ? <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p> : null}
      </div>
      <div className="shrink-0">{provenance}</div>
    </li>
  )
}
