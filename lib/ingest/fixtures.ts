import { createHash } from 'node:crypto'
import fixtures from './fixtures.generated.json'

type FixtureMap = Record<string, unknown>

/**
 * Content-addressed cache of extraction results for the documents in /samples.
 *
 * Committed to the repo and imported statically so it is bundled into the
 * deployment. Its only job is to keep the core demo beat working when the model
 * call is slow or unavailable. It is a fallback, never the primary path.
 */
export function fixtureKey(parts: (string | number | null)[]): string {
  const normalised = parts
    .map((p) => (typeof p === 'string' ? p.replace(/\r\n/g, '\n').trim() : String(p)))
    .join(' ')
  return createHash('sha256').update(normalised).digest('hex').slice(0, 32)
}

export function readFixture<T>(key: string): T | null {
  const map = fixtures as FixtureMap
  return (map[key] as T) ?? null
}

export function hasFixture(key: string): boolean {
  return key in (fixtures as FixtureMap)
}
