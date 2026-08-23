'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import type { Source } from '@/lib/spec/types'

export type ProvenanceInfo = {
  /** What the element does, in plain English. */
  statement: string
  source: Source | null
  version: number | null
  approvedBy: string | null
  approvedAt: string | null
  documentId: string | null
  /** Set when a pending change would alter this element. */
  pendingNote: string | null
}

/**
 * The answer to "why does the system think this?".
 *
 * Every rule, clock, transition and derived field carries a citation, so this
 * panel is never empty for anything the app inferred from a document — and the
 * cases where it IS empty (fields inferred from a spreadsheet) say so honestly
 * rather than inventing a clause.
 */
export function Provenance({
  info,
  label,
}: {
  info: ProvenanceInfo
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const chip = label ?? info.source?.clause ?? 'No citation'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded border border-dashed px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-solid hover:text-foreground"
      >
        {chip}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{info.source?.clause ?? 'Not from a document'}</SheetTitle>
            <SheetDescription>{info.statement}</SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-4 pb-8">
            {info.source ? (
              <section>
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Where it came from
                </h3>
                <blockquote className="mt-2 border-l-2 pl-3 text-sm leading-relaxed italic">
                  {info.source.quote}
                </blockquote>
                <p className="mt-3 text-sm">
                  <span className="text-muted-foreground">Document</span>{' '}
                  {info.documentId ? (
                    <Link
                      href={`/documents/${info.documentId}`}
                      className="font-medium underline underline-offset-4"
                    >
                      {info.source.document}
                    </Link>
                  ) : (
                    <span className="font-medium">{info.source.document}</span>
                  )}
                </p>
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">Clause</span>{' '}
                  <span className="font-medium">{info.source.clause}</span>
                </p>
              </section>
            ) : (
              <section>
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Where it came from
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Inferred from the shape of an imported spreadsheet, not from a
                  clause. Nothing here was read out of a policy document, so there
                  is nothing to cite.
                </p>
              </section>
            )}

            <section>
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                How it got here
              </h3>
              <dl className="mt-2 space-y-1.5 text-sm">
                {info.version !== null ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Introduced in</dt>
                    <dd className="font-medium">Version {info.version}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Approved by</dt>
                  <dd className="font-medium">{info.approvedBy ?? 'Not recorded'}</dd>
                </div>
                {info.approvedAt ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Approved on</dt>
                    <dd className="font-medium">{info.approvedAt}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {info.pendingNote ? (
              <Badge variant="outline" className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left text-xs">
                {info.pendingNote}
              </Badge>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
