import type { Metadata } from 'next'
import Link from 'next/link'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

import { NavLinks } from '@/components/nav-links'
import { RoleSwitcher } from '@/components/role-switcher'
import { UploadDialog } from '@/components/upload-dialog'
import { attention } from '@/lib/engine/attention'
import { getPrograms, getRecords, toContexts } from '@/lib/queries'
import { currentRole } from '@/lib/roles'
import { SAMPLE_OPTIONS } from '@/lib/samples'

/**
 * Every page reads live data and the role cookie, and the attention queue is
 * recomputed per request by design. Prerendering any of it would bake a queue
 * that is wrong the moment a clock ticks.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Workflow Agents',
  description:
    'Documents become a running workflow. Change the documents and the workflow changes with them.',
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const [role, programs, records] = await Promise.all([
    currentRole(),
    getPrograms(),
    getRecords(),
  ])

  const items = attention(toContexts(programs), records, new Date())
  const mine = items.filter((i) => i.ownerRole === null || i.ownerRole === role)

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid size-6 place-items-center rounded bg-foreground text-[11px] font-bold text-background">
                WA
              </span>
              <span className="hidden sm:inline">Workflow Agents</span>
            </Link>
            <NavLinks inboxCount={mine.length} />
            <div className="ml-auto flex items-center gap-3">
              <RoleSwitcher role={role} />
              <UploadDialog
                programs={programs.map((p) => ({
                  id: p.id,
                  name: p.name,
                  version: p.currentVersion,
                }))}
                samples={SAMPLE_OPTIONS}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t py-6">
          <div className="mx-auto w-full max-w-6xl px-4 text-xs text-muted-foreground">
            Every rule in this app traces to a clause in a document somebody approved.
          </div>
        </footer>

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
