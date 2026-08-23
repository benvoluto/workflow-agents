import { z } from 'zod'

/**
 * The expression DSL. Deliberately tiny: comparisons, boolean combinators, and
 * a presence check. There is no arbitrary expression form and no escape hatch —
 * that boundary is the whole safety story for model-authored rules.
 *
 * Operand convention: a bare string is a FIELD KEY. A literal must be wrapped,
 * as `{ "value": ... }`. This keeps `{ "gt": ["amount", { "value": 0 }] }`
 * unambiguous without needing to know the field list to parse it.
 */
export const operandSchema = z.union([
  z.string(),
  z.object({ value: z.union([z.string(), z.number(), z.boolean(), z.null()]) }),
])
export type Operand = z.infer<typeof operandSchema>

export type Expr =
  | { eq: [Operand, Operand] }
  | { gt: [Operand, Operand] }
  | { gte: [Operand, Operand] }
  | { lt: [Operand, Operand] }
  | { lte: [Operand, Operand] }
  | { isSet: Operand }
  | { and: Expr[] }
  | { or: Expr[] }
  | { not: Expr }

const pair = z.tuple([operandSchema, operandSchema])

export const exprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.union([
    z.object({ eq: pair }),
    z.object({ gt: pair }),
    z.object({ gte: pair }),
    z.object({ lt: pair }),
    z.object({ lte: pair }),
    z.object({ isSet: operandSchema }),
    z.object({ and: z.array(exprSchema) }),
    z.object({ or: z.array(exprSchema) }),
    z.object({ not: exprSchema }),
  ]),
)

/** Where a spec element came from. Required on every element, by design. */
export const sourceSchema = z.object({
  document: z.string().describe('File name of the source document'),
  clause: z.string().describe('Clause or section reference, e.g. "§4.2"'),
  quote: z
    .string()
    .describe('The sentence from the document that this element encodes'),
})
export type Source = z.infer<typeof sourceSchema>

export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'money',
  'date',
  'url',
  'checkbox',
  'signature',
  'select',
] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export const fieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  /** When present, the field is only required from this state onward. */
  requiredFrom: z.string().nullable(),
  options: z.array(z.string()).nullable(),
  source: sourceSchema.nullable(),
})
export type Field = z.infer<typeof fieldSchema>

export const ROLES = ['program_officer', 'finance', 'cfo'] as const
export type Role = (typeof ROLES)[number]

export const transitionSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string(),
  role: z.enum(ROLES),
  guard: exprSchema.nullable(),
  source: sourceSchema.nullable(),
})
export type Transition = z.infer<typeof transitionSchema>

/**
 * A precondition. When `when` holds, every key in `require` must be present in
 * the record's data before any forward transition is allowed.
 */
export const ruleSchema = z.object({
  id: z.string(),
  label: z.string(),
  when: exprSchema,
  require: z.array(z.string()),
  role: z.enum(ROLES).nullable(),
  source: sourceSchema.nullable(),
})
export type Rule = z.infer<typeof ruleSchema>

export const clockSchema = z.object({
  id: z.string(),
  label: z.string(),
  fromState: z.string(),
  days: z.number().int().positive(),
  warnAt: z.number().int().positive(),
  ownerRole: z.enum(ROLES),
  source: sourceSchema.nullable(),
})
export type Clock = z.infer<typeof clockSchema>

/** A clause the extractor could not turn into a rule. Surfaced, never guessed. */
export const unresolvedSchema = z.object({
  id: z.string(),
  summary: z.string(),
  source: sourceSchema,
})
export type Unresolved = z.infer<typeof unresolvedSchema>

export const specSchema = z.object({
  name: z.string(),
  entity: z.string(),
  fields: z.array(fieldSchema),
  states: z.array(z.string()),
  initial: z.string(),
  transitions: z.array(transitionSchema),
  rules: z.array(ruleSchema),
  clocks: z.array(clockSchema),
  unresolved: z.array(unresolvedSchema),
})
export type Spec = z.infer<typeof specSchema>

export const ROLE_LABELS: Record<Role, string> = {
  program_officer: 'Program Officer',
  finance: 'Finance',
  cfo: 'CFO',
}

/** Named people, so provenance reads like a person approved it, not a role. */
export const ROLE_PEOPLE: Record<Role, string> = {
  program_officer: 'Dana Whitfield',
  finance: 'Marcus Oyelaran',
  cfo: 'Priya Raman',
}

export function stateLabel(state: string): string {
  return state.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}
