import Link from 'next/link'
import {
  ChatTeardropTextIcon,
  CircleNotchIcon,
  PresentationChartIcon,
  ShieldCheckIcon,
  TreeStructureIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react/dist/ssr'
import { ExplainSheet } from '@/components/explain-sheet'

export type FunnelStage = {
  label: string
  count: number
  /** Something in the queue is sitting at this stage. */
  flagged: boolean
}

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

/**
 * A stepped area, one step per lifecycle stage, each step's height proportional
 * to how much work has reached it. Deliberately unlabelled on the y axis: the
 * numbers above it are the data, and the shape is only there to make the drop
 * between stages legible at a glance.
 */
function Funnel({ stages }: { stages: FunnelStage[] }) {
  if (stages.length === 0) return null
  const width = 360
  const height = 62
  const max = Math.max(...stages.map((s) => s.count), 1)
  const step = width / stages.length

  const points: string[] = []
  stages.forEach((stage, i) => {
    const y = height - Math.max((stage.count / max) * height, 2)
    points.push(`${i * step},${y}`, `${(i + 1) * step},${y}`)
  })
  const area = `0,${height} ${points.join(' ')} ${width},${height}`
  const line = points.join(' ')

  return (
    <div className="min-w-0 flex-1">
      <div className="flex" style={{ maxWidth: width }}>
        {stages.map((stage) => (
          <div key={stage.label} className="flex-1">
            <span className="flex items-center gap-1.5 text-[15px] font-medium tabular-nums">
              {stage.count.toLocaleString('en-US')}
              {stage.flagged ? (
                <WarningCircleIcon size={16} weight="bold" className="text-overdue" />
              ) : null}
            </span>
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-1 h-[62px] w-full"
        style={{ maxWidth: width }}
        preserveAspectRatio="none"
        aria-hidden
      >
        <polygon points={area} className="fill-brand-line/45" />
        <polyline points={line} className="stroke-brand" strokeWidth={2.5} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="flex" style={{ maxWidth: width }}>
        {stages.map((stage) => (
          <span key={stage.label} className="flex-1 text-[13px] text-muted-foreground">
            {stage.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export { ChatTeardropTextIcon }
