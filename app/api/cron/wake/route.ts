import { processWakeups } from '@/lib/engine/materialize'
import { authorised, unauthorised } from '../authorise'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Recompute only the records the calendar has reached.
 *
 * Every wakeup was written down when the record entered its state — the engine
 * never has to be asked "who is overdue now", because the instant each record
 * would turn over is derivable from `stateEnteredAt` and the clock. So this
 * scans an index on one timestamp rather than every grant in flight, and on
 * most runs does nothing at all.
 *
 * It is also the hook for everything a queue computed on page load cannot do:
 * notifying whoever owns an item the moment it breaches, escalating one that
 * has been overdue for a week, and closing the gap where a payment passed its
 * service level objective at 2am and the system's reaction was to wait for
 * somebody to open a browser.
 */
export async function GET(request: Request) {
  if (!authorised(request)) return unauthorised()

  const started = Date.now()
  const result = await processWakeups(new Date())

  return Response.json({
    ran: 'wake',
    durationMs: Date.now() - started,
    ...result,
  })
}
