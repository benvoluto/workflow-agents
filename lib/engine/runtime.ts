import { evaluate } from '@/lib/spec/expr'
import { isOverridden } from '@/lib/spec/overrides'
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
 *
 * A field somebody has overridden is not missing any more — not because a value
 * appeared, but because the requirement was waived by a named person and that
 * decision is on the record.
 */
export function missingRequiredFields(spec: Spec, record: RecordLike): Field[] {
  const here = stateIndex(spec, record.state)
  return spec.fields.filter((f) => {
    if (!f.required) return false
    if (f.requiredFrom && stateIndex(spec, f.requiredFrom) > here) return false
    if (isOverridden(record.data, f.key)) return false
    return isEmpty(record.data[f.key])
  })
}

/**
 * Rules whose condition holds but whose requirements have not been satisfied.
 *
 * Deliberately blind to overrides: a rule is a named control with a named role,
 * and nothing in this app lets one be waived from a queue card. Only the
 * emptiness of a required *field* can be overridden.
 */
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


/**
 * The two things a queue card is allowed to do without opening the record.
 *
 * Both are derived here rather than in the queue, so the button that appears
 * and the server action that fires are reading the same definition. Each names
 * the role it belongs to; the queue offers it to nobody else, and the action
 * re-derives it before it writes.
 */
export type InlineAction =
  | {
      kind: 'sign'
      recordId: string
      fieldKey: string
      fieldLabel: string
      role: Role
    }
  | {
      kind: 'override_evidence'
      recordId: string
      fieldKey: string
      fieldLabel: string
      role: Role
    }

/**
 * The signature a rule is waiting on, when that is the whole of what it is
 * waiting on.
 *
 * A rule requiring a signature and something else is not signable in one
 * click — the card sends that one to the record instead of half-doing it.
 */
export function signatureFor(
  spec: Spec,
  rule: Rule,
  record: RecordLike,
): InlineAction | null {
  if (!rule.role) return null
  const outstanding = rule.require.filter((key) => isEmpty(record.data[key]))
  if (outstanding.length !== 1) return null
  const field = spec.fields.find((f) => f.key === outstanding[0])
  if (!field || field.type !== 'signature') return null
  return {
    kind: 'sign',
    recordId: record.id,
    fieldKey: field.key,
    fieldLabel: field.label,
    role: rule.role,
  }
}

/**
 * A missing evidence link that the role owing the next move could decide to
 * proceed without.
 *
 * Evidence is a required `url` field — the type, not a particular key, because
 * the spec is authored by whatever document arrived, and the key it chose is
 * its own business.
 *
 * The override covers that one requirement and no other. A record missing an
 * evidence link and something else stays in the queue after it, with the link
 * no longer on the list — which is the truth, and better than either hiding
 * the button or implying one click cleared everything.
 */
export function evidenceOverrideFor(
  spec: Spec,
  record: RecordLike,
): InlineAction | null {
  const field = missingRequiredFields(spec, record).find((f) => f.type === 'url')
  if (!field) return null
  const owner = forwardTransitions(spec, record)[0]?.role
  if (!owner) return null
  return {
    kind: 'override_evidence',
    recordId: record.id,
    fieldKey: field.key,
    fieldLabel: field.label,
    role: owner,
  }
}
