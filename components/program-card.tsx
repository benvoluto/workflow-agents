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
    <article className="@container rounded-2xl border border-brand-line bg-brand-soft p-6">
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

      {/*
        Three columns only when the card is actually wide enough for them.
        The card sits in a half-width column, so a viewport breakpoint would be
        the wrong signal: below ~40rem of card the funnel gets squeezed until
        its stage labels collide, and stacking is the only honest fix.
      */}
      <div className="mt-5 grid items-start gap-x-8 gap-y-6 @[40rem]:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]">
        <Link
          href={`/programs/${program.id}`}
          className="text-[26px] leading-[1.15] font-bold text-brand hover:underline"
        >
          {program.name}
        </Link>

        <Funnel stages={program.stages} />

        <div className="flex flex-wrap gap-x-6 gap-y-2.5 @[40rem]:flex-col @[40rem]:gap-2.5">
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
