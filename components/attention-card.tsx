import Link from 'next/link'
import {
  ArrowsClockwiseIcon,
  BellSimpleZIcon,
  ChatTeardropTextIcon,
  ClockCountdownIcon,
  DotsThreeVerticalIcon,
  LockKeyIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react/dist/ssr'
import { ExplainSheet } from '@/components/explain-sheet'
import { ItemMenu } from '@/components/item-menu'
import { SnoozeButton } from '@/components/snooze-button'
import type { AttentionItem, Urgency } from '@/lib/engine/attention'
import { money } from '@/lib/format'
import { ROLE_PEOPLE } from '@/lib/spec/types'
import { cn } from '@/lib/utils'

const TONE: Record<Urgency, { panel: string; text: string; label: string }> = {
  overdue: { panel: 'bg-overdue-soft', text: 'text-overdue', label: 'Overdue' },
  due_soon: { panel: 'bg-due-soon-soft', text: 'text-due-soon', label: 'Due soon' },
  blocked: { panel: 'bg-blocked-soft', text: 'text-blocked', label: 'Blocked' },
  change: { panel: 'bg-change-soft', text: 'text-change', label: 'Pending change' },
}

const REASON_ICON = {
  'Clock breach': WarningCircleIcon,
  'Clock warning': ClockCountdownIcon,
  'Awaiting approval': LockKeyIcon,
  'Missing information': WarningCircleIcon,
  'Change impact': ArrowsClockwiseIcon,
} as const

/**
 * One thing that needs a person, as a split card: what it is on the tinted
 * left, what to do about it on the white right.
 *
 * The tint carries the urgency, so a queue can be read at a glance without
 * anybody parsing the sentences.
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
        'flex flex-col overflow-hidden rounded-2xl sm:flex-row',
        tone.panel,
        snoozedUntil && 'opacity-60',
      )}
    >
      <div className="flex w-full shrink-0 flex-col gap-2 p-5 sm:w-[34%]">
        <span className={cn('flex items-center gap-1.5 font-semibold', tone.text)}>
          <Icon size={19} weight="bold" />
          {snoozedUntil ? 'Snoozed' : tone.label}
        </span>
        <Link href={href} className="text-[17px] leading-snug font-semibold text-foreground hover:underline">
          {item.headline}
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 rounded-2xl border bg-card p-5">
        <p className="text-[15px] leading-relaxed text-foreground/80">
          {item.amount !== null ? (
            <span className="font-medium text-foreground">{money(item.amount)} </span>
          ) : null}
          {item.subline}.{' '}
          {item.ownerRole ? (
            <>
              Owned by {roleWord(item.ownerRole)} &middot; Contact{' '}
              <span className="text-link">{ROLE_PEOPLE[item.ownerRole]}</span>.{' '}
            </>
          ) : null}
          {item.evidence ? (
            <ExplainSheet
              item={serialise(item)}
              trigger="source"
            />
          ) : null}
        </p>

        <div className="flex items-center gap-5">
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

function roleWord(role: keyof typeof ROLE_PEOPLE): string {
  return role === 'cfo' ? 'the CFO' : role === 'finance' ? 'Finance' : 'the Program Officer'
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

export { ChatTeardropTextIcon, BellSimpleZIcon, DotsThreeVerticalIcon }
