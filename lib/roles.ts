import { cookies } from 'next/headers'
import { ROLES, ROLE_LABELS, ROLE_PEOPLE, type Role } from '@/lib/spec/types'

const COOKIE = 'wa_role'

/**
 * There is no auth. The role is a cookie and the role switcher sets it.
 *
 * That is not a shortcut taken to save time: for this app the interesting
 * property is that the same records produce three different queues, and being
 * able to flip between them in one click is the point. Real auth would only
 * make that harder to see.
 */
export async function currentRole(): Promise<Role> {
  const store = await cookies()
  const value = store.get(COOKIE)?.value
  return (ROLES as readonly string[]).includes(value ?? '')
    ? (value as Role)
    : 'program_officer'
}

export function actorFor(role: Role): string {
  return ROLE_PEOPLE[role]
}

export { COOKIE as ROLE_COOKIE, ROLE_LABELS, ROLE_PEOPLE, ROLES }
export type { Role }
