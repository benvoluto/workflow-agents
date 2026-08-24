import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

import { AppHeader } from '@/components/app-header'
import { AskBar } from '@/components/ask-bar'
import { getPendingDeltas, getPrograms } from '@/lib/queries'
import { currentRole } from '@/lib/roles'
import { SAMPLE_OPTIONS } from '@/lib/samples'

/**
 * Every page reads live data and the role cookie, and the attention queue is
 * recomputed per request by design. Prerendering any of it would bake a queue
 * that is wrong the moment a clock ticks.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Grants•OS',
  description:
    'Documents become a running workflow. Change the documents and the workflow changes with them.',
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const [role, programs, pending] = await Promise.all([
    currentRole(),
    getPrograms(),
    getPendingDeltas(),
  ])

  const options = programs.map((p) => ({
    id: p.id,
    name: p.name,
    version: p.currentVersion,
  }))

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <AppHeader role={role} />

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-8 pb-16">{children}</main>

        <AskBar
          programs={options}
          samples={SAMPLE_OPTIONS}
          pendingDeltaId={pending[0]?.id ?? null}
        />

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
