'use client'

import { useTransition } from 'react'
import { BellSimpleRingingIcon, BellSimpleZIcon } from '@phosphor-icons/react'
import { snoozeItem, unsnoozeItem } from '@/app/actions'

/**
 * Hide one queue item for three days. The condition behind it keeps running —
 * the clock does not pause and the rule stays unmet — so the item returns on
 * its own rather than needing to be remembered.
 *
 * Calls the action directly rather than submitting a form, because the same
 * control appears inside a menu that unmounts its items on click, and a
 * disconnected submitter cancels the submission.
 */
export function SnoozeButton({ itemId, snoozed }: { itemId: string; snoozed: boolean }) {
  const [pending, startTransition] = useTransition()
  const Icon = snoozed ? BellSimpleRingingIcon : BellSimpleZIcon

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => (snoozed ? unsnoozeItem(itemId) : snoozeItem(itemId, 3)))
      }
      className="flex cursor-pointer items-center gap-1.5 text-[15px] font-medium text-action transition-opacity hover:opacity-75 disabled:opacity-50"
    >
      <Icon size={19} />
      {pending ? '…' : snoozed ? 'Wake' : 'Snooze'}
    </button>
  )
}
