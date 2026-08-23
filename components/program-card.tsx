import Link from 'next/link'
import {
  CircleNotchIcon,
  PresentationChartIcon,
  ShieldCheckIcon,
  TreeStructureIcon,
} from '@phosphor-icons/react/dist/ssr'
import { ExplainSheet } from '@/components/explain-sheet'
import { Funnel, type FunnelStage } from '@/components/funnel'

export type { FunnelStage }

export type ProgramCardData = {
  id: string
  name: string
  version: number
  pendingVersion: number | null
  stages: FunnelStage[]
  explain: {
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
}

/**
 * A program as a shape rather than a row: where its work has got to, what
 * version is in force, and whether a change is waiting on somebody.
 */
export function ProgramCard({ program }: { program: ProgramCardData }) {
  return (
    <article className="rounded-2xl border border-brand-line bg-brand-soft p-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-brand">
          <ShieldCheckIcon size={19} weight="fill" />v{program.version}
        </span>
        {program.pendingVersion ? (
          <Link
            href={`/programs/${program.id}`}
            className="flex items-center gap-1.5 text-[15px] font-semibold text-change hover:underline"
          >
            <CircleNotchIcon size={18} weight="bold" className="animate-spin [animation-duration:3s]" />
            v{program.pendingVersion} pending
          </Link>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-start gap-x-8 gap-y-6">
        <Link
          href={`/programs/${program.id}`}
          className="max-w-[13rem] flex-1 text-[26px] leading-[1.15] font-bold text-brand hover:underline"
        >
          {program.name}
        </Link>

        <Funnel stages={program.stages} />

        <div className="flex flex-col gap-2.5">
          <ExplainSheet item={program.explain} />
          <Link
            href={`/records?program=${program.id}`}
            className="flex items-center gap-2 text-[15px] font-medium text-brand transition-opacity hover:opacity-75"
          >
            <TreeStructureIcon size={19} />
            Review Pipeline
          </Link>
          <Link
            href={`/programs/${program.id}`}
            className="flex items-center gap-2 text-[15px] font-medium text-brand transition-opacity hover:opacity-75"
          >
            <PresentationChartIcon size={19} />
            Review Performance
          </Link>
        </div>
      </div>
    </article>
  )
}
