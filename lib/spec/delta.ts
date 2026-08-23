import { z } from 'zod'
import {
  clockSchema,
  fieldSchema,
  ruleSchema,
  transitionSchema,
  unresolvedSchema,
  type Spec,
} from './types'

/**
 * The containment boundary for model output.
 *
 * The extractor never returns a whole spec and never returns free text that
 * reaches an evaluator. It returns a list of typed operations, each carrying a
 * plain-English summary and a citation. Anything it cannot express as one of
 * these shapes has to come back as `unresolved`.
 */
export const deltaOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add_state'),
    summary: z.string(),
    state: z.string(),
    after: z.string().nullish(),
  }),
  z.object({ op: z.literal('add_field'), summary: z.string(), field: fieldSchema }),
  z.object({ op: z.literal('modify_field'), summary: z.string(), field: fieldSchema }),
  z.object({
    op: z.literal('add_transition'),
    summary: z.string(),
    transition: transitionSchema,
  }),
  z.object({
    op: z.literal('modify_transition'),
    summary: z.string(),
    transition: transitionSchema,
  }),
  z.object({ op: z.literal('add_rule'), summary: z.string(), rule: ruleSchema }),
  z.object({ op: z.literal('modify_rule'), summary: z.string(), rule: ruleSchema }),
  z.object({ op: z.literal('add_clock'), summary: z.string(), clock: clockSchema }),
  z.object({ op: z.literal('modify_clock'), summary: z.string(), clock: clockSchema }),
  z.object({
    op: z.literal('unresolved'),
    summary: z.string(),
    item: unresolvedSchema,
  }),
])
export type DeltaOp = z.infer<typeof deltaOpSchema>

export const deltaSchema = z.object({
  ops: z.array(deltaOpSchema),
})
export type Delta = z.infer<typeof deltaSchema>

/** Human label for the operation chip in the review UI. */
export function opKind(op: DeltaOp): 'Added' | 'Modified' | 'Unresolved' {
  if (op.op === 'unresolved') return 'Unresolved'
  return op.op.startsWith('add_') ? 'Added' : 'Modified'
}

export function opTarget(op: DeltaOp): { kind: string; id: string; label: string } {
  switch (op.op) {
    case 'add_state':
      return { kind: 'state', id: op.state, label: op.state }
    case 'add_field':
    case 'modify_field':
      return { kind: 'field', id: op.field.key, label: op.field.label }
    case 'add_transition':
    case 'modify_transition':
      return { kind: 'transition', id: op.transition.id, label: op.transition.label }
    case 'add_rule':
    case 'modify_rule':
      return { kind: 'rule', id: op.rule.id, label: op.rule.label }
    case 'add_clock':
    case 'modify_clock':
      return { kind: 'clock', id: op.clock.id, label: op.clock.label }
    case 'unresolved':
      return { kind: 'clause', id: op.item.id, label: op.item.summary }
  }
}

/**
 * The element an operation would replace, if any. This is the conflict UI's
 * entire detection mechanism: matching on id.
 */
export function currentElement(spec: Spec, op: DeltaOp): unknown | null {
  switch (op.op) {
    case 'modify_field':
      return spec.fields.find((f) => f.key === op.field.key) ?? null
    case 'modify_transition':
      return spec.transitions.find((t) => t.id === op.transition.id) ?? null
    case 'modify_rule':
      return spec.rules.find((r) => r.id === op.rule.id) ?? null
    case 'modify_clock':
      return spec.clocks.find((c) => c.id === op.clock.id) ?? null
    default:
      return null
  }
}

function upsert<T>(list: T[], item: T, match: (a: T) => boolean): T[] {
  const i = list.findIndex(match)
  if (i === -1) return [...list, item]
  const next = [...list]
  next[i] = item
  return next
}

/** Apply a set of operations to a spec, returning a new spec. Pure. */
export function applyOps(spec: Spec, ops: DeltaOp[]): Spec {
  let next: Spec = structuredClone(spec)
  for (const op of ops) {
    switch (op.op) {
      case 'add_state': {
        if (next.states.includes(op.state)) break
        const at = op.after ? next.states.indexOf(op.after) : -1
        const states = [...next.states]
        if (at === -1) states.push(op.state)
        else states.splice(at + 1, 0, op.state)
        next = { ...next, states }
        break
      }
      case 'add_field':
      case 'modify_field':
        next = {
          ...next,
          fields: upsert(next.fields, op.field, (f) => f.key === op.field.key),
        }
        break
      case 'add_transition':
      case 'modify_transition':
        next = {
          ...next,
          transitions: upsert(
            next.transitions,
            op.transition,
            (t) => t.id === op.transition.id,
          ),
        }
        break
      case 'add_rule':
      case 'modify_rule':
        next = { ...next, rules: upsert(next.rules, op.rule, (r) => r.id === op.rule.id) }
        break
      case 'add_clock':
      case 'modify_clock':
        next = {
          ...next,
          clocks: upsert(next.clocks, op.clock, (c) => c.id === op.clock.id),
        }
        break
      case 'unresolved':
        next = {
          ...next,
          unresolved: upsert(
            next.unresolved ?? [],
            op.item,
            (u) => u.id === op.item.id,
          ),
        }
        break
    }
  }
  // Any state named by a transition must exist, or the engine would strand records.
  const known = new Set(next.states)
  for (const t of next.transitions) {
    for (const s of [t.from, t.to]) {
      if (!known.has(s)) {
        known.add(s)
        next.states.push(s)
      }
    }
  }
  return next
}
