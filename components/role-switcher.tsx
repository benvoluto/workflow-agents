import { setRole } from '@/app/actions'
import { cn } from '@/lib/utils'
import { ROLES, ROLE_LABELS, ROLE_PEOPLE, type Role } from '@/lib/spec/types'

/**
 * Three buttons in a form, no client JavaScript. The switcher is the closest
 * thing this app has to authentication, and the point of it is to make the same
 * set of records produce three visibly different queues in one click.
 */
export function RoleSwitcher({ role }: { role: Role }) {
  return (
    <form action={setRole} className="flex items-center gap-2">
      <div className="flex items-center rounded-lg border bg-card p-0.5">
        {ROLES.map((r) => (
          <button
            key={r}
            type="submit"
            name="role"
            value={r}
            aria-pressed={r === role}
            title={ROLE_PEOPLE[r]}
            className={cn(
              'cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              r === role
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {ROLE_PEOPLE[role]}
      </span>
    </form>
  )
}
