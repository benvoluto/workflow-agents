'use client'

import { useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CaretDownIcon, UserIcon } from '@phosphor-icons/react'
import { setRole } from '@/app/actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLES, ROLE_LABELS, ROLE_PEOPLE, type Role } from '@/lib/spec/types'
import { cn } from '@/lib/utils'

export function AppHeader({ role }: { role: Role }) {
  const [pending, startTransition] = useTransition()

  return (
    <header className="mx-auto w-full max-w-[1600px] px-8 pt-8 pb-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/" className="flex items-end justify-end gap-4">
          <Image
            src="/liif-logo.svg"
            alt="Grants•OS"
            width={98}
            height={94}
            className="h-[58px] w-auto"
            priority
          />
          <span className="rounded-full bg-[#E1E6F1] px-4 py-1.5 text-sm font-semibold text-muted-foreground">
            GRANTS•OS
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
                <span className={cn('font-medium', pending && 'opacity-60')}>
                  {ROLE_PEOPLE[role]}, {ROLE_LABELS[role]}
                </span>
              </span>
              <span className="grid place-items-center border-l px-3">
                <CaretDownIcon size={16} className="text-muted-foreground" />
              </span>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64">
              {/*
                The label is Base UI's Menu.GroupLabel, which throws if it is not
                inside a Group. And the action is called directly rather than
                submitted from a form, because the item unmounts the instant it
                is clicked, and a disconnected submitter cancels the submission.
              */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>View the queue as</DropdownMenuLabel>
                {ROLES.map((r) => (
                  <DropdownMenuItem
                    key={r}
                    onClick={() => startTransition(() => setRole(r))}
                    className={cn('cursor-pointer', r === role && 'bg-accent')}
                  >
                    <span className="flex flex-col items-start">
                      <span>{ROLE_PEOPLE[r]}</span>
                      <span className="text-xs text-muted-foreground">
                        {ROLE_LABELS[r]}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link href="/grants" />}>
                  All grants
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/programs" />}>
                  All programs
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
