/**
 * Shared guard for the scheduled endpoints.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. With no secret set
 * the routes stay open, which is what makes them runnable locally with curl
 * during development — in a deployment, set one.
 */
export function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export function unauthorised(): Response {
  return Response.json({ error: 'Unauthorised' }, { status: 401 })
}
