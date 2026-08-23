import type { Spec } from './types'

/** A program that exists only as a name, waiting for a document to give it shape. */
export function emptySpec(name: string): Spec {
  return {
    name,
    entity: 'Record',
    fields: [],
    states: [],
    initial: '',
    transitions: [],
    rules: [],
    clocks: [],
    unresolved: [],
  }
}

/**
 * The program's name as a document implies it.
 *
 * A contract's heading is usually "<Program> — Program Agreement"; the part
 * before the dash is the program, the part after describes the document.
 */
export function titleFromDocument(name: string, body: string): string {
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim()
  if (heading) return heading.split(/\s+[—–-]\s+/)[0].trim()
  return name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
}
