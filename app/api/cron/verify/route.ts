import { verifyQueue } from '@/lib/engine/materialize'
import { authorised, unauthorised } from '../authorise'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Prove the cache still agrees with the engine.
 *
 * Materialising a queue normally costs you the one property that made it
 * trustworthy: that there is exactly one definition of what needs attention, so
 * the queue cannot quietly be wrong. It does not cost that here, because the
 * pure function is still the arbiter and this asks it. A non-empty diff is a
 * bug report, not a reconciliation step — nothing here writes.
 */
export async function GET(request: Request) {
  if (!authorised(request)) return unauthorised()

  const verification = await verifyQueue(new Date())
  return Response.json(verification, { status: verification.ok ? 200 : 409 })
}
