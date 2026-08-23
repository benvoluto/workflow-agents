export function money(value: unknown): string {
  if (typeof value !== 'number') return '—'
  return `$${value.toLocaleString('en-US')}`
}

export function shortDate(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function dateTime(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const DAY = 24 * 60 * 60 * 1000

export function daysIn(since: Date, now = new Date()): number {
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.round((day(now) - day(since)) / DAY)
}

export function ageLabel(since: Date, now = new Date()): string {
  const d = daysIn(since, now)
  if (d === 0) return 'today'
  return `${d}d`
}

/** Render a stored field value for display, by its declared type. */
export function displayValue(value: unknown, type: string): string {
  if (value === null || value === undefined || value === '') return '—'
  switch (type) {
    case 'money':
      return money(value)
    case 'date':
      return shortDate(value as string)
    case 'checkbox':
      return value ? 'Yes' : 'No'
    case 'number':
      return typeof value === 'number' ? value.toLocaleString('en-US') : String(value)
    default:
      return String(value)
  }
}
