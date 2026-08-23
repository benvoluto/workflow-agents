import type { ProvenanceInfo } from '@/components/provenance'
import type { ProgramSummary } from '@/lib/queries'
import { dateTime } from '@/lib/format'
import type { Spec } from '@/lib/spec/types'

type Kind = 'field' | 'transition' | 'rule' | 'clock'

function elementAt(spec: Spec | undefined, kind: Kind, id: string): unknown {
  if (!spec) return undefined
  switch (kind) {
    case 'field':
      return spec.fields.find((f) => f.key === id)
    case 'transition':
      return spec.transitions.find((t) => t.id === id)
    case 'rule':
      return spec.rules.find((r) => r.id === id)
    case 'clock':
      return spec.clocks.find((c) => c.id === id)
  }
}

/**
 * Trace an element back to the version that last changed it, and from there to
 * the document, clause, and person who approved it.
 *
 * "Last changed" rather than "first appeared": for a rule an amendment has
 * since edited, the honest answer to "why is the threshold $25,000" is the
 * amendment, not the original contract that said $50,000.
 */
export function provenanceFor(
  program: ProgramSummary,
  kind: Kind,
  id: string,
  statement: string,
  pendingNote: string | null = null,
): ProvenanceInfo {
  const versions = program.versions
  let introduced = versions[0]

  for (let i = 0; i < versions.length; i++) {
    const here = JSON.stringify(elementAt(versions[i].spec, kind, id) ?? null)
    const before =
      i === 0 ? 'null' : JSON.stringify(elementAt(versions[i - 1].spec, kind, id) ?? null)
    if (here !== 'null' && here !== before) introduced = versions[i]
  }

  const element = elementAt(introduced?.spec, kind, id) as { source?: unknown } | undefined
  const source =
    element && typeof element === 'object' && 'source' in element
      ? ((element.source as ProvenanceInfo['source']) ?? null)
      : null

  return {
    statement,
    source,
    version: introduced?.version ?? null,
    approvedBy: introduced?.approvedBy ?? null,
    approvedAt: introduced ? dateTime(introduced.createdAt) : null,
    documentId: introduced?.sourceDocumentId ?? null,
    pendingNote,
  }
}
