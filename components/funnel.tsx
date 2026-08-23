import { WarningCircleIcon } from '@phosphor-icons/react/dist/ssr'

export type FunnelStage = {
  label: string
  count: number
  /** Something in the queue is sitting at this stage. */
  flagged: boolean
}

/**
 * A stair-step of a program's pipeline: one plateau per stage, its height set by
 * how much work has reached it, joined by slopes where the count drops.
 *
 * The fill stops at each plateau's own extent rather than running continuously
 * under the slopes, so the eye reads three quantities being compared rather than
 * one quantity changing over time — which is what a funnel actually is.
 */

const WIDTH = 360
const HEIGHT = 66
const BASELINE = 58
const TOP = 4
const SLOPE = 18

function geometry(stages: FunnelStage[]) {
  const column = WIDTH / stages.length
  const max = Math.max(...stages.map((s) => s.count), 1)

  return stages.map((stage, i) => {
    const last = i === stages.length - 1
    const start = i * column
    // The last plateau runs to the edge; the others stop short to leave room
    // for the slope down to the next one.
    const end = last ? WIDTH : start + column - SLOPE
    // A stage that is not empty always shows a sliver, so "some" never reads
    // as "none" just because the scale is dominated by an earlier stage.
    const height = stage.count === 0 ? 0 : Math.max((stage.count / max) * (BASELINE - TOP), 3)
    return { start, end, y: BASELINE - height, stage }
  })
}

export function Funnel({ stages }: { stages: FunnelStage[] }) {
  if (stages.length === 0) return null
  const bars = geometry(stages)

  const path = bars
    .map((bar, i) => `${i === 0 ? 'M' : 'L'} ${bar.start} ${bar.y} L ${bar.end} ${bar.y}`)
    .join(' ')

  return (
    <div className="min-w-0 flex-1" style={{ maxWidth: WIDTH }}>
      <div className="flex">
        {stages.map((stage) => (
          <span
            key={stage.label}
            className="flex flex-1 items-center gap-1.5 text-[17px] text-muted-foreground tabular-nums"
          >
            {stage.count.toLocaleString('en-US')}
            {stage.flagged ? (
              <WarningCircleIcon size={17} weight="bold" className="text-overdue" />
            ) : null}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-1 w-full"
        role="img"
        aria-label={stages.map((s) => `${s.label}: ${s.count}`).join(', ')}
      >
        {bars.map((bar) => (
          <rect
            key={bar.stage.label}
            x={bar.start}
            y={bar.y}
            width={Math.max(bar.end - bar.start, 0)}
            height={BASELINE - bar.y}
            className="fill-brand/12"
          />
        ))}

        <line
          x1={0}
          y1={BASELINE}
          x2={WIDTH}
          y2={BASELINE}
          className="stroke-foreground/15"
          strokeWidth={1}
        />

        <path
          d={path}
          className="stroke-brand"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      <div className="mt-1 flex">
        {stages.map((stage) => (
          <span key={stage.label} className="flex-1 text-[15px] text-muted-foreground">
            {stage.label}
          </span>
        ))}
      </div>
    </div>
  )
}
