'use client'

import { useState, useTransition } from 'react'
import { SealWarningIcon, SignatureIcon } from '@phosphor-icons/react'
import { overrideRequirement, signRequirement } from '@/app/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { InlineAction } from '@/lib/engine/runtime'

/**
 * Do the one thing this queue item is waiting for, without opening the record.
 *
 * Only rendered when the action belongs to the role currently looking, which
 * the server checks again before it writes. Taking it does not navigate: the
 * condition behind the item is gone, so the item leaves the queue on the
 * revalidation and the next one moves up.
 */
export function ItemAction({ action }: { action: InlineAction }) {
  return action.kind === 'sign' ? (
    <SignAction action={action} />
  ) : (
    <OverrideAction action={action} />
  )
}

function SignAction({ action }: { action: Extract<InlineAction, { kind: 'sign' }> }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <Inline error={error}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(await signRequirement(action.recordId, action.fieldKey))
          })
        }
        className="flex cursor-pointer items-center gap-1.5 text-[15px] font-medium text-action transition-opacity hover:opacity-75 disabled:opacity-50"
      >
        <SignatureIcon size={19} />
        {pending ? 'Signing…' : 'Sign'}
      </button>
    </Inline>
  )
}

/**
 * Waiving a requirement the contract states is not a click to make by accident,
 * and unlike a signature it has no equivalent anywhere else in the app to be
 * consistent with — so it asks first, and says plainly what it will and will
 * not do.
 */
function OverrideAction({
  action,
}: {
  action: Extract<InlineAction, { kind: 'override_evidence' }>
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <Inline error={error}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex cursor-pointer items-center gap-1.5 text-[15px] font-medium text-action transition-opacity hover:opacity-75"
      >
        <SealWarningIcon size={19} />
        Override missing evidence
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Proceed without {action.fieldLabel.toLowerCase()}?</DialogTitle>
            <DialogDescription>
              The link stays missing and still reads as missing on the record. What this
              adds is you, by name, on the history, saying this one goes ahead without it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const message = await overrideRequirement(
                    action.recordId,
                    action.fieldKey,
                  )
                  setError(message)
                  if (!message) setOpen(false)
                })
              }
            >
              {pending ? 'Recording…' : 'Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Inline>
  )
}

/** The control, with whatever the server said back if it refused. */
function Inline({
  error,
  children,
}: {
  error: string | null
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      {children}
      {error ? <span className="text-xs text-overdue">{error}</span> : null}
    </div>
  )
}
