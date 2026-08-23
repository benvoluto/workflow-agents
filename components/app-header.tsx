import Image from 'next/image'
import Link from 'next/link'
import { CaretDownIcon, UserIcon } from '@phosphor-icons/react/dist/ssr'
import { setRole } from '@/app/actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLES, ROLE_LABELS, ROLE_PEOPLE, type Role } from '@/lib/spec/types'

export function AppHeader({ role }: { role: Role }) {
  return (
    <header className="mx-auto w-full max-w-[1600px] px-8 pt-8 pb-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/" className="flex items-center gap-4">
          <Image
            src="/liif-logo.svg"
            alt="Liiff"
            width={98}
            height={94}
            className="h-[58px] w-auto"
            priority
          />
          <span className="rounded-full bg-secondary px-4 py-1.5 text-sm font-semibold tracking-[0.12em] text-muted-foreground">
            WORKFLOW&middot;AGENTS
          </span>
        </Link>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex cursor-pointer items-stretch overflow-hidden rounded-xl border bg-card text-sm shadow-xs transition-colors hover:bg-accent"
                />
              }
            >
              <span className="flex items-center gap-2.5 px-4 py-2.5">
                <UserIcon size={18} className="text-muted-foreground" />
                <span className="font-medium">
                  {ROLE_PEOPLE[role]}, {ROLE_LABELS[role]}
                </span>
              </span>
              <span className="grid place-items-center border-l px-3">
                <CaretDownIcon size={16} className="text-muted-foreground" />
              </span>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>View the queue as</DropdownMenuLabel>
              {ROLES.map((r) => (
                <form action={setRole} key={r}>
                  <input type="hidden" name="role" value={r} />
                  <DropdownMenuItem
                    render={<button type="submit" className="w-full cursor-pointer" />}
                    className={r === role ? 'bg-accent' : undefined}
                  >
                    <span className="flex flex-col items-start">
                      <span>{ROLE_PEOPLE[r]}</span>
                      <span className="text-xs text-muted-foreground">
                        {ROLE_LABELS[r]}
                      </span>
                    </span>
                  </DropdownMenuItem>
                </form>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/records" />}>
                All records
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/programs" />}>
                All programs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
