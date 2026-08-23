'use client'

import { useFormStatus } from 'react-dom'
import { BellSimpleRingingIcon, BellSimpleZIcon } from '@phosphor-icons/react'
import { snoozeItem, unsnoozeItem } from '@/app/actions'

function Inner({ snoozed }: { snoozed: boolean }) {
  const { pending } = useFormStatus()
  const Icon = snoozed ? BellSimpleRingingIcon : BellSimpleZIcon
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex cursor-pointer items-center gap-1.5 text-[15px] font-medium text-action transition-opacity hover:opacity-75 disabled:opacity-50"
    >
      <Icon size={19} />
      {pending ? '…' : snoozed ? 'Wake' : 'Snooze'}
    </button>
  )
}

/**
 * Hide one queue item for three days. The condition behind it keeps running —
 * the clock does not pause and the rule stays unmet — so the item returns on
 * its own rather than needing to be remembered.
 */
export function SnoozeButton({ itemId, snoozed }: { itemId: string; snoozed: boolean }) {
  return (
    <form action={snoozed ? unsnoozeItem : snoozeItem}>
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="days" value="3" />
      <Inner snoozed={snoozed} />
    </form>
  )
}
