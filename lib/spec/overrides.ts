/**
 * A requirement somebody decided to proceed without.
 *
 * Kept inside the record's `data` under a reserved key rather than in its own
 * table, for the same reason the spec is one JSON document: there is no schema
 * to migrate, and an override travels with the record it belongs to. The key
 * starts with an underscore, which no field key extracted from a document or a
 * spreadsheet header ever does.
 *
 * An override never invents a value. The evidence link is still missing, and
 * still reads as missing everywhere it is displayed — what changes is that a
 * named person has taken responsibility for moving on without it, in writing,
 * in the audit trail.
 */
export const OVERRIDES_KEY = '_overrides'

export type Override = {
  /** The person, by name — the same string an event's actor carries. */
  by: string
  at: string
  reason: string | null
}

export type Data = Record<string, unknown>

export function overridesOf(data: Data): Record<string, Override> {
  const raw = data[OVERRIDES_KEY]
  return raw && typeof raw === 'object' ? (raw as Record<string, Override>) : {}
}

export function overrideOf(data: Data, key: string): Override | null {
  return overridesOf(data)[key] ?? null
}

export function isOverridden(data: Data, key: string): boolean {
  return Boolean(overridesOf(data)[key])
}

/** The data to store when a requirement is waived. Never mutates the input. */
export function withOverride(
  data: Data,
  key: string,
  override: Override,
): Data {
  return { ...data, [OVERRIDES_KEY]: { ...overridesOf(data), [key]: override } }
}
