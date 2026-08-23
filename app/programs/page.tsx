import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { StateChip } from '@/components/state-chip'
import { getPrograms, getRecords } from '@/lib/queries'
import { shortDate } from '@/lib/format'

export default async function ProgramsPage() {
  const [programs, records] = await Promise.all([getPrograms(), getRecords()])

  if (programs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-16 text-center">
        <h1 className="text-lg font-medium">No programs yet</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Upload a spreadsheet or a contract from the header and one will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each one is a specification extracted from documents, versioned every time
          somebody approves a change.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {programs.map((program) => {
          const mine = records.filter((r) => r.programId === program.id)
          const behind = mine.filter((r) => r.specVersion < program.currentVersion)
          const spec = program.currentSpec
          return (
            <Link
              key={program.id}
              href={`/programs/${program.id}`}
              className="rounded-xl border bg-card p-5 transition-colors hover:bg-accent/50"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-medium">{program.name}</h2>
                <Badge variant="outline">v{program.currentVersion}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {mine.length} {mine.length === 1 ? program.entity.toLowerCase() : `${program.entity.toLowerCase()}s`}
                {' · '}
                {spec?.rules.length ?? 0} {spec?.rules.length === 1 ? 'rule' : 'rules'}
                {' · '}
                {spec?.clocks.length ?? 0} {spec?.clocks.length === 1 ? 'clock' : 'clocks'}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(spec?.states ?? []).map((s) => (
                  <StateChip key={s} state={s} className="text-[11px]" />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Last changed {shortDate(program.versions[program.versions.length - 1]?.createdAt)}
                {behind.length > 0 ? ` · ${behind.length} on an older version` : ''}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
