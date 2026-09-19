import { recomputeAll, verifyQueue } from '@/lib/engine/materialize'
import { authorised, unauthorised } from '../authorise'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * The midnight sweep.
 *
 * `now` reaches the attention engine only through a calendar-day difference, so
 * for a fixed set of records and specs the queue is a step function that can
 * only move at UTC midnight. That makes this the one scheduled recomputation
 * the system actually needs: not a polling interval chosen by feel, but the
 * exact instant at which time alone can change an answer.
 *
 * It recomputes every program, then verifies the result against a fresh run of
 * the engine, so a drifting cache is reported rather than served.
 */
export async function GET(request: Request) {
  if (!authorised(request)) return unauthorised()

  const started = Date.now()
  const now = new Date()
  const written = await recomputeAll(now)
  const verification = await verifyQueue(now)

  return Response.json({
    ran: 'sweep',
    at: now.toISOString(),
    durationMs: Date.now() - started,
    ...written,
    verification: {
      ok: verification.ok,
      fresh: verification.fresh,
      cached: verification.cached,
      missing: verification.missing.length,
      extra: verification.extra.length,
      changed: verification.changed.length,
    },
  })
}
