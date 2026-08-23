import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { stateLabel } from '@/lib/spec/types'

/**
 * States are defined by the spec, not by us, so the tone is inferred from the
 * name rather than looked up in a fixed table. A program whose lifecycle we have
 * never seen still renders sensibly.
 */
function toneFor(state: string): string {
  const s = state.toLowerCase()
  if (/(paid|complete|accepted|approved_final|done)/.test(s))
    return 'border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
  if (/(closed|archived|cancelled|canceled)/.test(s))
    return 'border-muted-foreground/20 bg-muted text-muted-foreground'
  if (/(pending|review|progress|active|processing)/.test(s))
    return 'border-amber-600/25 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
  return 'border-sky-600/25 bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200'
}

export function StateChip({ state, className }: { state: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium', toneFor(state), className)}>
      {stateLabel(state)}
    </Badge>
  )
}
