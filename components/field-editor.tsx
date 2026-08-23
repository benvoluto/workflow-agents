'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateField } from '@/app/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Role } from '@/lib/spec/types'
import { ROLE_PEOPLE } from '@/lib/spec/types'

const INPUT_TYPE: Record<string, string> = {
  money: 'number',
  number: 'number',
  date: 'date',
  url: 'url',
  text: 'text',
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Saving…' : label}
    </Button>
  )
}

/**
 * Inline edit for one field, rendered from its declared type.
 *
 * A signature is not a text box: it is a button that records who pressed it and
 * when, which is the only version of a signature this app can honestly claim to
 * have. Whoever is not allowed to sign gets told why rather than being shown a
 * disabled control with no explanation.
 */
export function FieldEditor({
  recordId,
  fieldKey,
  label,
  type,
  value,
  role,
  lockedReason,
}: {
  recordId: string
  fieldKey: string
  label: string
  type: string
  value: unknown
  role: Role
  lockedReason?: string | null
}) {
  const [open, setOpen] = useState(false)

  if (type === 'signature') {
    if (value) {
      return <span className="text-xs text-muted-foreground">Signed</span>
    }
    if (lockedReason) {
      return (
        <span className="text-xs text-muted-foreground" title={lockedReason}>
          {lockedReason}
        </span>
      )
    }
    return (
      <form action={updateField}>
        <input type="hidden" name="recordId" value={recordId} />
        <input type="hidden" name="key" value={fieldKey} />
        <input type="hidden" name="type" value="signature" />
        <input type="hidden" name="value" value="" />
        <SignButton />
      </form>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="xs" />}>
        {value === null || value === undefined || value === '' ? 'Set' : 'Edit'}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Saved against this record as {ROLE_PEOPLE[role]}, with an entry in its history.
          </DialogDescription>
        </DialogHeader>
        <form action={updateField} className="grid gap-4">
          <input type="hidden" name="recordId" value={recordId} />
          <input type="hidden" name="key" value={fieldKey} />
          <input type="hidden" name="type" value={type} />
          <div className="grid gap-1.5">
            <Label htmlFor={`field-${fieldKey}`}>{label}</Label>
            {type === 'textarea' ? (
              <Textarea
                id={`field-${fieldKey}`}
                name="value"
                rows={4}
                defaultValue={value ? String(value) : ''}
              />
            ) : (
              <Input
                id={`field-${fieldKey}`}
                name="value"
                type={INPUT_TYPE[type] ?? 'text'}
                defaultValue={value !== null && value !== undefined ? String(value) : ''}
              />
            )}
          </div>
          <Submit label="Save" />
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SignButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="xs" disabled={pending}>
      {pending ? 'Signing…' : 'Sign'}
    </Button>
  )
}
