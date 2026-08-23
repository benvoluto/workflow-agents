import Link from 'next/link'
import { cn } from '@/lib/utils'

export type Tone = 'neutral' | 'overdue' | 'blocked' | 'due_soon' | 'change' | 'brand'

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-link',
  overdue: 'text-overdue',
  blocked: 'text-blocked',
  due_soon: 'text-due-soon',
  change: 'text-change',
  brand: 'text-brand',
}

export type Tab = {
  key: string
  label: string
  count?: number
  tone?: Tone
  href: string
  active: boolean
}

/**
 * Filter tabs that keep their own colour whether selected or not: the tint is
 * what the tab means, and the white pill is only which one you are on. A
 * selected "Overdue" that turned grey would lose the one thing worth seeing
 * from across a room.
 */
export function FilterTabs({ tabs, className }: { tabs: Tab[]; className?: string }) {
  return (
    <nav className={cn('flex flex-wrap items-center gap-1', className)}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={cn(
            'rounded-full px-4 py-1.5 text-[15px] font-medium transition-all',
            TONE_TEXT[tab.tone ?? 'neutral'],
            tab.active
              ? 'bg-card shadow-sm ring-1 ring-black/5'
              : 'hover:bg-black/[0.03]',
          )}
        >
          {tab.count === undefined ? tab.label : `${tab.count} ${tab.label}`}
        </Link>
      ))}
    </nav>
  )
}
