import Link from 'next/link'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr'
import { StateChip } from '@/components/state-chip'
import { money } from '@/lib/format'

export type GrantPreviewRow = {
  id: string
  ref: string
  title: string
  amount: number | null
  state: string
  /** Something in the queue is pointing at this grant. */
  flagged: boolean
}

/**
 * The handful of grants that moved most recently under a program.
 *
 * Sits directly under its program card so the shape above it — how much work has
 * reached each stage — has named, clickable examples underneath, rather than
 * leaving the whole record list a level away behind a menu.
 */
export function GrantsPreview({
  programId,
  total,
  rows,
}: {
  programId: string
  total: number
  rows: GrantPreviewRow[]
}) {
  if (rows.length === 0) return null

  return (
    <section className="rounded-2xl border-2 border-[#EEEEED] bg-card">
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
        <h3 className="text-[15px] font-semibold">Recent grants</h3>
        <Link
          href={`/grants?program=${programId}`}
          className="flex items-center gap-1.5 text-[15px] font-medium text-link transition-opacity hover:opacity-75"
        >
          See all {total}
          <ArrowRightIcon size={16} />
        </Link>
      </header>

      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/grants/${row.id}`}
              className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-accent/50"
            >
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                {row.title}
                {row.flagged ? (
                  <span
                    aria-label="needs attention"
                    className="ml-2 inline-block size-1.5 shrink-0 rounded-full bg-overdue align-middle"
                  />
                ) : null}
              </span>
              <span className="shrink-0 text-[15px] text-muted-foreground tabular-nums">
                {row.amount === null ? '' : money(row.amount)}
              </span>
              <StateChip state={row.state} className="shrink-0 text-[11px]" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
