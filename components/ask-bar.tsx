'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { ArrowRightIcon, PaperPlaneRightIcon } from '@phosphor-icons/react'
import { askQuestion, type AskResult } from '@/app/ask'
import { UploadDialog, type SampleOption } from '@/components/upload-dialog'

type ProgramOption = { id: string; name: string; version: number }

function Send() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Ask"
      className="absolute right-3 bottom-3 grid size-9 cursor-pointer place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <PaperPlaneRightIcon size={17} weight="fill" />
      )}
    </button>
  )
}

/**
 * A question box over the current state of the system, and the four things
 * somebody is most likely to want to start.
 *
 * The answer is read-only by construction — the model gets a snapshot and no
 * tools — so this can sit at the bottom of every screen without being a way to
 * change anything by accident.
 */
export function AskBar({
  programs,
  samples,
  pendingDeltaId,
}: {
  programs: ProgramOption[]
  samples: SampleOption[]
  pendingDeltaId: string | null
}) {
  const [state, formAction] = useActionState<AskResult | null, FormData>(
    askQuestion,
    null,
  )

  return (
    <div className="sticky bottom-0 z-30 border-t bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className="mx-auto grid w-full max-w-[1600px] gap-x-8 gap-y-6 px-8 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <form action={formAction} className="relative">
            <textarea
              name="question"
              rows={2}
              placeholder="Ask any question…"
              className="w-full resize-none rounded-2xl border bg-card px-5 py-4 pr-14 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <Send />
          </form>

          {state?.answer ? (
            <div className="mt-3 max-h-[28vh] overflow-y-auto rounded-2xl border bg-card px-5 py-4">
              <p className="text-xs text-muted-foreground">{state.question}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-wrap">
                {state.answer}
              </p>
            </div>
          ) : null}
          {state?.error ? (
            <p className="mt-3 rounded-2xl border border-overdue/30 bg-overdue-soft px-5 py-4 text-[15px] text-overdue">
              {state.error}
            </p>
          ) : null}
        </div>

        <div className="grid content-start gap-x-10 gap-y-4 sm:grid-cols-2">
          <UploadDialog
            programs={programs}
            samples={samples}
            defaultTab="file"
            trigger={<QuickAction label="Create a Program" />}
          />
          <UploadDialog
            programs={programs}
            samples={samples}
            defaultTab="file"
            trigger={<QuickAction label="Create a Pipeline" />}
          />
          <UploadDialog
            programs={programs}
            samples={samples}
            defaultTab="sample"
            trigger={<QuickAction label="Create a Version" />}
          />
          <QuickAction
            label="Review Approvals"
            href={pendingDeltaId ? `/review/${pendingDeltaId}` : '/programs'}
          />
        </div>
      </div>
    </div>
  )
}

function QuickAction({ label, href }: { label: string; href?: string }) {
  const inner = (
    <>
      <ArrowRightIcon size={19} />
      {label}
    </>
  )
  const className =
    'flex w-fit cursor-pointer items-center gap-2.5 text-[15px] font-medium text-link transition-opacity hover:opacity-75'

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" className={className}>
      {inner}
    </button>
  )
}
