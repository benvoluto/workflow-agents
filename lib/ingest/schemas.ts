import { z } from 'zod'
import type { DeltaOp } from '@/lib/spec/delta'
import {
  FIELD_TYPES,
  ROLES,
  type Clock,
  type Expr,
  type Field,
  type Operand,
  type Rule,
  type Source,
  type Spec,
  type Transition,
  type Unresolved,
} from '@/lib/spec/types'

/**
 * The wire format the model writes, which is deliberately not the domain model.
 *
 * Structured output puts hard limits on the schemas it will compile: no
 * self-reference, no positional tuples, and at most sixteen union-typed fields
 * in the whole document. The domain model breaks all three — its expression
 * language is recursive, its comparisons are pairs, and almost every element has
 * a nullable `source`.
 *
 * So generation uses flat, fully-required shapes with explicit sentinels, and
 * everything here is normalised into the real types before it goes anywhere
 * near the database. Keeping the two apart means the domain model stays the
 * shape the app wants to read, rather than the shape an API will accept.
 */

const OPS = ['eq', 'gt', 'gte', 'lt', 'lte', 'is_set', 'is_not_set'] as const
const VALUE_TYPES = ['number', 'text', 'boolean', 'none'] as const

const genClause = z.object({
  field: z.string().describe('Field key this condition tests'),
  op: z.enum(OPS),
  value: z
    .string()
    .describe('The literal to compare against, as text. Empty for is_set / is_not_set.'),
  valueType: z
    .enum(VALUE_TYPES)
    .describe('How to read "value". Use "none" for is_set and is_not_set.'),
})

const genCondition = z.object({
  match: z.enum(['all', 'any']).describe('How to combine the clauses'),
  clauses: z.array(genClause).describe('Empty means "always true"'),
})

const genSource = z.object({
  document: z.string(),
  clause: z.string().describe('Clause reference, e.g. "4.2". Empty if there is none.'),
  quote: z.string().describe('The sentence this encodes, verbatim. Empty if none.'),
})

const genField = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  requiredFrom: z
    .string()
    .describe('State from which this becomes required. Empty if required from the start.'),
  options: z.array(z.string()).describe('Only for type "select". Otherwise empty.'),
  source: genSource,
})

const genTransition = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string(),
  role: z.enum(ROLES),
  guard: genCondition,
  source: genSource,
})

const genRule = z.object({
  id: z.string(),
  label: z.string(),
  when: genCondition,
  require: z.array(z.string()).describe('Field keys that must be filled in'),
  role: z.enum(ROLES).describe('Whose job it is to satisfy this'),
  source: genSource,
})

const genClock = z.object({
  id: z.string(),
  label: z.string(),
  fromState: z.string(),
  days: z.number().int().positive(),
  warnAt: z.number().int().positive(),
  ownerRole: z.enum(ROLES),
  source: genSource,
})

const genUnresolved = z.object({
  id: z.string(),
  summary: z.string(),
  source: genSource,
})

/**
 * What a spreadsheet can actually tell you, and nothing more.
 *
 * No sources, because there is no document to cite; no rules or clocks, because
 * a table contains no policy. Asking for the full specification here produced a
 * grammar too large to compile, and every field it would have added was one the
 * model was being told to leave empty anyway.
 */
export const genTableSpecSchema = z.object({
  name: z.string().describe('What this program should be called'),
  entity: z.string().describe('Singular noun for one row, e.g. "Award"'),
  fields: z.array(
    z.object({
      key: z.string().describe('snake_case key'),
      label: z.string(),
      type: z.enum(FIELD_TYPES),
      required: z.boolean(),
    }),
  ),
  states: z.array(z.string()).describe('Three snake_case lifecycle states, in order'),
  transitions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      from: z.string(),
      to: z.string(),
    }),
  ),
})

const withMode = <T extends z.ZodRawShape>(shape: z.ZodObject<T>) =>
  z.object({
    mode: z
      .enum(['add', 'modify'])
      .describe('"modify" reuses an existing id; "add" introduces a new element'),
    summary: z.string().describe('One plain-English sentence saying what changes'),
    element: shape,
  })

/**
 * The delta arrives as two documents, not one.
 *
 * Structure (what a record is, and how it moves) and policy (the rules and
 * deadlines that govern it) are asked for separately, because one schema
 * covering both compiles to a grammar the API rejects as too large. Splitting it
 * also gives each call a single job, and the two are independent, so they run
 * at the same time and cost no extra latency.
 */
export const genStructureSchema = z.object({
  states: z
    .array(z.object({ summary: z.string(), state: z.string() }))
    .describe('New lifecycle states this document introduces, in snake_case'),
  fields: z.array(withMode(genField)),
  transitions: z.array(withMode(genTransition)),
})

export const genPolicySchema = z.object({
  rules: z.array(withMode(genRule)),
  clocks: z.array(withMode(genClock)),
  unresolved: z
    .array(z.object({ summary: z.string(), element: genUnresolved }))
    .describe('Clauses that carry an obligation but no number to act on'),
})

type GenSource = z.infer<typeof genSource>
type GenCondition = z.infer<typeof genCondition>
type GenField = z.infer<typeof genField>
type GenTransition = z.infer<typeof genTransition>
type GenRule = z.infer<typeof genRule>
type GenClock = z.infer<typeof genClock>
type GenUnresolved = z.infer<typeof genUnresolved>

function toSource(s: GenSource | undefined): Source | null {
  if (!s || (!s.clause.trim() && !s.quote.trim())) return null
  return { document: s.document, clause: s.clause, quote: s.quote }
}

function toOperand(clause: z.infer<typeof genClause>): Operand {
  switch (clause.valueType) {
    case 'number': {
      const n = Number(clause.value.replace(/[$,\s]/g, ''))
      return { value: Number.isFinite(n) ? n : clause.value }
    }
    case 'boolean':
      return { value: /^(true|yes|y|1)$/i.test(clause.value) }
    case 'none':
      return { value: null }
    default:
      return { value: clause.value }
  }
}

/** Flat clauses back into the recursive expression the evaluator understands. */
function toExpr(condition: GenCondition | undefined): Expr | null {
  const clauses = (condition?.clauses ?? []).filter((c) => c.field.trim() !== '')
  if (clauses.length === 0) return null

  const parts: Expr[] = clauses.map((c) => {
    if (c.op === 'is_set') return { isSet: c.field }
    if (c.op === 'is_not_set') return { not: { isSet: c.field } }
    return { [c.op]: [c.field, toOperand(c)] } as Expr
  })

  if (parts.length === 1) return parts[0]
  return condition?.match === 'any' ? { or: parts } : { and: parts }
}

function toField(f: GenField): Field {
  return {
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    requiredFrom: f.requiredFrom.trim() || null,
    options: f.options.length > 0 ? f.options : null,
    source: toSource(f.source),
  }
}

function toTransition(t: GenTransition): Transition {
  return {
    id: t.id,
    from: t.from,
    to: t.to,
    label: t.label,
    role: t.role,
    guard: toExpr(t.guard),
    source: toSource(t.source),
  }
}

function toRule(r: GenRule): Rule {
  return {
    id: r.id,
    label: r.label,
    // A rule with no condition applies to everything, which is what `true` is.
    when: toExpr(r.when) ?? { isSet: r.require[0] ?? 'id' },
    require: r.require,
    role: r.role,
    source: toSource(r.source),
  }
}

function toClock(c: GenClock): Clock {
  return {
    id: c.id,
    label: c.label,
    fromState: c.fromState,
    days: c.days,
    warnAt: Math.min(c.warnAt, c.days),
    ownerRole: c.ownerRole,
    source: toSource(c.source),
  }
}

function toUnresolved(u: GenUnresolved): Unresolved {
  return {
    id: u.id,
    summary: u.summary,
    source: toSource(u.source) ?? {
      document: u.source?.document ?? 'unknown',
      clause: u.source?.clause ?? '',
      quote: u.source?.quote ?? '',
    },
  }
}

export function toTableSpec(gen: z.infer<typeof genTableSpecSchema>): Spec {
  return {
    name: gen.name,
    entity: gen.entity,
    fields: gen.fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      requiredFrom: null,
      options: null,
      source: null,
    })),
    states: gen.states,
    initial: gen.states[0] ?? '',
    // Everything imported from a table is the Program Officer's to move on
    // until a contract says who else is involved.
    transitions: gen.transitions.map((t) => ({
      id: t.id,
      from: t.from,
      to: t.to,
      label: t.label,
      role: 'program_officer' as const,
      guard: null,
      source: null,
    })),
    rules: [],
    clocks: [],
    unresolved: [],
  }
}

/**
 * Flatten the two halves into the ordered operation list the reviewer sees.
 *
 * Ordering is fixed rather than however the model happened to emit it: states
 * first because later elements refer to them, then the data and the moves, then
 * the rules and clocks that act on them, and the unresolved clauses last.
 */
export function toOps(
  structure: z.infer<typeof genStructureSchema>,
  policy: z.infer<typeof genPolicySchema>,
): DeltaOp[] {
  const out: DeltaOp[] = []

  for (const s of structure.states) {
    if (s.state.trim()) {
      out.push({ op: 'add_state', summary: s.summary, state: s.state, after: null })
    }
  }
  for (const f of structure.fields) {
    out.push({
      op: f.mode === 'modify' ? 'modify_field' : 'add_field',
      summary: f.summary,
      field: toField(f.element),
    })
  }
  for (const t of structure.transitions) {
    out.push({
      op: t.mode === 'modify' ? 'modify_transition' : 'add_transition',
      summary: t.summary,
      transition: toTransition(t.element),
    })
  }
  for (const r of policy.rules) {
    out.push({
      op: r.mode === 'modify' ? 'modify_rule' : 'add_rule',
      summary: r.summary,
      rule: toRule(r.element),
    })
  }
  for (const c of policy.clocks) {
    out.push({
      op: c.mode === 'modify' ? 'modify_clock' : 'add_clock',
      summary: c.summary,
      clock: toClock(c.element),
    })
  }
  for (const u of policy.unresolved) {
    out.push({ op: 'unresolved', summary: u.summary, item: toUnresolved(u.element) })
  }

  return out
}
