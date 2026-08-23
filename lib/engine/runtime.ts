import { evaluate } from '@/lib/spec/expr'
import type { Field, Role, Rule, Spec, Transition } from '@/lib/spec/types'

export type RecordLike = {
  id: string
  ref: string
  programId: string
  specVersion: number
  state: string
  data: Record<string, unknown>
  stateEnteredAt: Date
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '' || v === false
}

function stateIndex(spec: Spec, state: string): number {
  const i = spec.states.indexOf(state)
  return i === -1 ? 0 : i
}

/**
 * Required fields that are still empty. `requiredFrom` lets a field become
 * required partway through the lifecycle rather than at creation, which is what
 * makes CSV import possible at all.
 */
export function missingRequiredFields(spec: Spec, record: RecordLike): Field[] {
  const here = stateIndex(spec, record.state)
  return spec.fields.filter((f) => {
    if (!f.required) return false
    if (f.requiredFrom && stateIndex(spec, f.requiredFrom) > here) return false
    return isEmpty(record.data[f.key])
  })
}

/** Rules whose condition holds but whose requirements have not been satisfied. */
export function unmetRules(spec: Spec, record: RecordLike): Rule[] {
  return spec.rules.filter(
    (r) =>
      evaluate(r.when, record.data) &&
      r.require.some((key) => isEmpty(record.data[key])),
  )
}

export type AvailableTransition = {
  transition: Transition
  enabled: boolean
  /** Why it is not enabled, in the order the UI should show them. */
  blockedBy: string[]
}

/**
 * Every transition out of the record's current state that belongs to this role,
 * with the reasons it cannot fire. Disabled-with-a-reason beats hidden: the
 * point of the app is telling people what is in the way.
 */
export function availableTransitions(
  spec: Spec,
  record: RecordLike,
  role: Role,
): AvailableTransition[] {
  const missing = missingRequiredFields(spec, record)
  const unmet = unmetRules(spec, record)

  return spec.transitions
    .filter((t) => t.from === record.state && t.role === role)
    .map((t) => {
      const blockedBy: string[] = []
      for (const rule of unmet) {
        const needed = rule.require
          .filter((key) => isEmpty(record.data[key]))
          .map((key) => spec.fields.find((f) => f.key === key)?.label ?? key)
        blockedBy.push(`${rule.label} — needs ${needed.join(', ')}`)
      }
      for (const f of missing) {
        blockedBy.push(`${f.label} is empty`)
      }
      if (!evaluate(t.guard, record.data)) {
        blockedBy.push('Conditions for this action are not met')
      }
      return { transition: t, enabled: blockedBy.length === 0, blockedBy }
    })
}

/** Every transition out of this state, regardless of role — for "who is it with". */
export function forwardTransitions(spec: Spec, record: RecordLike): Transition[] {
  return spec.transitions.filter((t) => t.from === record.state)
}

/** The role that owes the next move on this record, if there is exactly one. */
export function owningRole(spec: Spec, record: RecordLike): Role | null {
  const unmet = unmetRules(spec, record)
  if (unmet.length > 0) {
    const withRole = unmet.find((r) => r.role)
    if (withRole?.role) return withRole.role
  }
  const forward = forwardTransitions(spec, record)
  const roles = new Set(forward.map((t) => t.role))
  return roles.size === 1 ? [...roles][0] : null
}

/** Validate a transition before it is committed. Returns an error, or null. */
export function validateTransition(
  spec: Spec,
  record: RecordLike,
  transitionId: string,
  role: Role,
): string | null {
  const t = spec.transitions.find((x) => x.id === transitionId)
  if (!t) return 'That action no longer exists in this version of the program.'
  if (t.from !== record.state) return `This record is no longer in ${t.from}.`
  if (t.role !== role) return 'That action belongs to a different role.'
  const available = availableTransitions(spec, record, role).find(
    (a) => a.transition.id === transitionId,
  )
  if (!available) return 'That action is not available.'
  if (!available.enabled) return available.blockedBy[0]
  return null
}

/** Fields to render on the detail form, in spec order. */
export function renderFields(spec: Spec): Field[] {
  return spec.fields
}
