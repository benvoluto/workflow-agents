'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: 'Inbox' },
  { href: '/records', label: 'Records' },
  { href: '/programs', label: 'Programs' },
]

export function NavLinks({ inboxCount }: { inboxCount: number }) {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active =
          link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {link.label}
            {link.href === '/' && inboxCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-foreground px-1.5 py-0.5 text-[11px] font-semibold text-background tabular-nums">
                {inboxCount > 99 ? '99+' : inboxCount}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
