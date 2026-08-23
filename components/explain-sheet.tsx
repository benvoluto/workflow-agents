'use client'

import { useState } from 'react'
import { ChatTeardropTextIcon } from '@phosphor-icons/react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export type ExplainItem = {
  id: string
  reason: string
  headline: string
  subline: string
  programName: string
  recordRef: string | null
  ownerName: string | null
  evidence: { document: string; clause: string; quote: string } | null
  resolution: string
  ageLabel: string
}

/**
 * Why this is in the queue, in the words of the document that put it there.
 *
 * Nothing here is generated at read time: the clause and the quote were
 * captured when the rule was extracted, so this is a lookup, not a retelling.
 */
export function ExplainSheet({
  item,
  trigger,
}: {
  item: ExplainItem
  trigger?: 'source'
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {trigger === 'source' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cursor-pointer text-link underline-offset-4 hover:underline"
        >
          Show source.
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex cursor-pointer items-center gap-1.5 text-[15px] font-medium text-action transition-opacity hover:opacity-75"
        >
          <ChatTeardropTextIcon size={19} />
          Explain
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{item.headline}</SheetTitle>
            <SheetDescription>
              {item.programName}
              {item.recordRef ? ` · ${item.recordRef}` : ''} · {item.ageLabel}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-4 pb-8">
            <Block title="Why it is here">
              <p className="text-sm leading-relaxed">
                {item.subline}.
                {item.ownerName ? ` It is waiting on ${item.ownerName}.` : ''}
              </p>
            </Block>

            {item.evidence ? (
              <Block title="The clause it comes from">
                <blockquote className="border-l-2 pl-3 text-sm leading-relaxed italic">
                  {item.evidence.quote}
                </blockquote>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.evidence.document} {item.evidence.clause}
                </p>
              </Block>
            ) : (
              <Block title="The clause it comes from">
                <p className="text-sm text-muted-foreground">
                  This one does not come from a clause. It is the system noticing a
                  required value is missing, not a policy being enforced.
                </p>
              </Block>
            )}

            <Block title="What clears it">
              <p className="text-sm leading-relaxed">{item.resolution}</p>
            </Block>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}
