import Link from 'next/link'
import {
  ArrowsClockwiseIcon,
  ClockCountdownIcon,
  LockKeyIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react/dist/ssr'
import { ExplainSheet } from '@/components/explain-sheet'
import { ItemMenu } from '@/components/item-menu'
import { SnoozeButton } from '@/components/snooze-button'
import type { AttentionItem, Urgency } from '@/lib/engine/attention'
import { money } from '@/lib/format'
import { ROLE_LABELS, ROLE_PEOPLE, type Role } from '@/lib/spec/types'
import { cn } from '@/lib/utils'

const TONE: Record<Urgency, { panel: string; accent: string; ink: string; label: string }> = {
  overdue: {
    panel: 'bg-overdue-soft',
    accent: 'text-overdue',
    ink: 'text-overdue-ink',
    label: 'Overdue',
  },
  due_soon: {
    panel: 'bg-due-soon-soft',
    accent: 'text-due-soon',
    ink: 'text-due-soon-ink',
    label: 'Due soon',
  },
  blocked: {
    panel: 'bg-blocked-soft',
    accent: 'text-blocked',
    ink: 'text-blocked-ink',
    label: 'Blocked',
  },
  change: {
    panel: 'bg-change-soft',
    accent: 'text-change',
    ink: 'text-change-ink',
    label: 'Pending change',
  },
}

const REASON_ICON = {
  'Clock breach': WarningCircleIcon,
  'Clock warning': ClockCountdownIcon,
  'Awaiting approval': LockKeyIcon,
  'Missing information': WarningCircleIcon,
  'Change impact': ArrowsClockwiseIcon,
} as const

/**
 * One thing that needs a person, as a single rounded card split down the middle:
 * what it is on the tinted left, what to do about it on the white right.
 *
 * The tint carries the urgency and the title is darkened from the same hue, so
 * a queue can be sorted by eye from across a room before anybody reads a word
 * of it.
 */
export function AttentionCard({
  item,
  snoozedUntil,
}: {
  item: AttentionItem
  snoozedUntil?: Date | null
}) {
  const tone = TONE[item.urgency]
  const Icon = REASON_ICON[item.reason as keyof typeof REASON_ICON] ?? WarningCircleIcon
  const href = item.recordId ? `/records/${item.recordId}` : `/programs/${item.programId}`

  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-3xl sm:flex-row',
        tone.panel,
        snoozedUntil && 'opacity-60',
      )}
    >
      <div className="flex w-full shrink-0 flex-col gap-2.5 p-6 sm:w-[31%]">
        <span className={cn('flex items-center gap-1.5 font-semibold', tone.accent)}>
          <Icon size={19} weight="bold" className="shrink-0" />
          {snoozedUntil ? 'Snoozed' : tone.label}
        </span>
        <Link
          href={href}
          className={cn(
            'text-[17px] leading-[1.35] font-bold hover:underline',
            tone.ink,
          )}
        >
          {item.headline}
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-5 bg-card p-6">
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {item.amount !== null ? `${money(item.amount)} ` : ''}
          {item.subline}.{' '}
          {item.ownerRole ? (
            <>
              Owned by {ROLE_LABELS[item.ownerRole]} &middot; Contact{' '}
              <Contact role={item.ownerRole} />{' '}
            </>
          ) : null}
          <ExplainSheet item={serialise(item)} trigger="source" />
        </p>

        <div className="flex items-center gap-8">
          <ExplainSheet item={serialise(item)} />
          <SnoozeButton itemId={item.id} snoozed={Boolean(snoozedUntil)} />
          <div className="ml-auto">
            <ItemMenu href={href} itemId={item.id} documentHref={null} />
          </div>
        </div>
      </div>
    </article>
  )
}

function Contact({ role }: { role: Role }) {
  return <span className="text-link">{ROLE_PEOPLE[role]}.</span>
}

/** Only what the sheet renders — the rest of the item stays on the server. */
function serialise(item: AttentionItem) {
  return {
    id: item.id,
    reason: item.reason,
    headline: item.headline,
    subline: item.subline,
    programName: item.programName,
    recordRef: item.recordRef,
    ownerName: item.ownerRole ? ROLE_PEOPLE[item.ownerRole] : null,
    evidence: item.evidence,
    resolution: item.resolution,
    ageLabel: item.ageLabel,
  }
}
