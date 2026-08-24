'use client'

import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { loadSample, uploadDocument } from '@/app/actions'

/** Only what the dialog renders. Sample bodies stay on the server. */
export type SampleOption = { id: string; program: string; name: string }

type ProgramOption = { id: string; name: string; version: number }

/**
 * Extraction takes as long as it takes. Rather than an indeterminate spinner,
 * step through what the server is actually doing, so the wait reads as work
 * rather than as the app having hung.
 */
const STAGES = [
  'Reading the document…',
  'Finding the clauses that carry rules…',
  'Comparing against the current program…',
  'Writing the changes up for review…',
]

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  // Mounting Stages only while pending means its state starts fresh each time,
  // with no reset to write back into React from an effect.
  return pending ? <Stages /> : <>{children}</>
}

function Stages() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const timer = setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      4000,
    )
    return () => clearInterval(timer)
  }, [])

  return (
    <span className="flex items-center gap-2">
      <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {STAGES[stage]}
    </span>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <Pending>{label}</Pending>
    </Button>
  )
}

function ProgramPicker({ programs }: { programs: ProgramOption[] }) {
  if (programs.length === 0) {
    return <input type="hidden" name="programId" value="" />
  }
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="programId">Apply to</Label>
      <select
        id="programId"
        name="programId"
        defaultValue={programs[0]?.id ?? ''}
        className="border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} (v{p.version})
          </option>
        ))}
        <option value="">— Start a new program —</option>
      </select>
      <p className="text-xs text-muted-foreground">
        A spreadsheet adds records to the chosen program. A contract or amendment
        proposes changes to its rules.
      </p>
    </div>
  )
}

export function UploadDialog({
  programs,
  samples,
  trigger,
  defaultTab = 'sample',
}: {
  programs: ProgramOption[]
  samples: SampleOption[]
  trigger?: React.ReactElement
  defaultTab?: 'sample' | 'file' | 'paste'
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger nativeButton render={trigger} />
      ) : (
        <DialogTrigger render={<Button size="sm" />}>Upload a document</DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a document</DialogTitle>
          <DialogDescription>
            A spreadsheet becomes records. A contract or amendment becomes a set of
            proposed changes for you to review before anything takes effect.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full">
            <TabsTrigger value="sample">Samples</TabsTrigger>
            <TabsTrigger value="file">Upload</TabsTrigger>
            <TabsTrigger value="paste">Paste</TabsTrigger>
          </TabsList>

          <TabsContent value="sample" className="mt-4">
            <form action={loadSample} className="grid gap-4">
              <ProgramPicker programs={programs} />
              <div className="grid gap-2">
                {samples.map((s) => (
                  <SampleRow key={s.id} sample={s} />
                ))}
              </div>
            </form>
          </TabsContent>

          <TabsContent value="file" className="mt-4">
            <form action={uploadDocument} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  name="file"
                  type="file"
                  accept=".md,.txt,.csv,text/markdown,text/plain,text/csv"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  .md, .txt or .csv. PDFs are out of scope for now.
                </p>
              </div>
              <ProgramPicker programs={programs} />
              <SubmitButton label="Read this document" />
            </form>
          </TabsContent>

          <TabsContent value="paste" className="mt-4">
            <form action={uploadDocument} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue="pasted-clause.md" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="text">Text</Label>
                <Textarea
                  id="text"
                  name="text"
                  rows={8}
                  required
                  placeholder="Paste a clause, a policy, or an amendment…"
                />
              </div>
              <ProgramPicker programs={programs} />
              <SubmitButton label="Read this text" />
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function SampleRow({ sample }: { sample: SampleOption }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name="sampleId"
      value={sample.id}
      disabled={pending}
      className="flex w-full cursor-pointer items-center justify-between rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{sample.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {sample.program.replace(/-/g, ' ')}
        </span>
      </span>
      <span className="ml-3 shrink-0 text-xs text-muted-foreground">
        <Pending>Load</Pending>
      </span>
    </button>
  )
}
