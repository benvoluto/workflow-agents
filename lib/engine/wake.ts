import type { RecordLike } from './runtime'
import type { Spec } from '@/lib/spec/types'

const DAY = 24 * 60 * 60 * 1000

function startOfDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * The next instant at which this record's urgency could change on its own.
 *
 * `now` reaches the attention engine only through `daysBetween`, which floors
 * both instants to UTC midnight. So for a fixed record and spec the queue is a
 * step function of time, and every step lands on a UTC midnight that is already
 * computable from `stateEnteredAt`. Nothing has to poll for an item going
 * overdue; the moment it will happen can be written down when the record enters
 * the state.
 *
 * Two boundaries per applicable clock:
 *
 *   warning   elapsed >= warnAt          at startOfDay(entered) + warnAt days
 *   breach    daysBetween(now, due) < 0  at startOfDay(entered) + (days + 1) days
 *
 * The breach boundary is also the one change-impact uses for a tightened clock,
 * which is why the caller passes the current spec alongside the pinned one.
 *
 * Returns null when nothing about this record is waiting on the calendar — it
 * is blocked, or complete, or in a state no clock watches. Such a record can
 * only change because somebody writes to it, and that path recomputes directly.
 */
export function nextWakeAt(
  record: RecordLike,
  specs: (Spec | undefined)[],
  now: Date,
): Date | null {
  const entered = startOfDay(record.stateEnteredAt)
  const after = now.getTime()
  let soonest: number | null = null

  const consider = (at: number) => {
    if (at <= after) return
    if (soonest === null || at < soonest) soonest = at
  }

  const seen = new Set<string>()
  for (const spec of specs) {
    if (!spec) continue
    for (const clock of spec.clocks) {
      if (clock.fromState !== record.state) continue
      // The same clock id can appear in both the pinned and the current spec
      // with different day counts; both boundaries matter, neither twice.
      const key = `${clock.id}:${clock.warnAt}:${clock.days}`
      if (seen.has(key)) continue
      seen.add(key)
      consider(entered + clock.warnAt * DAY)
      consider(entered + (clock.days + 1) * DAY)
    }
  }

  return soonest === null ? null : new Date(soonest)
}

/**
 * The next UTC midnight. The sweep runs here because day-count labels — "waiting
 * 9 days", "3 days over" — move for every open item at once, whatever their
 * urgency does.
 */
export function nextMidnight(now: Date): Date {
  return new Date(startOfDay(now) + DAY)
}
