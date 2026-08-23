import type { Expr, Field, Operand, Spec } from './types'

type Data = Record<string, unknown>

function resolve(operand: Operand, data: Data): unknown {
  if (typeof operand === 'string') return data[operand]
  return operand.value
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '' || v === false
}

/** Numeric comparison that refuses to guess: non-numbers compare as false. */
function compare(
  a: unknown,
  b: unknown,
  op: 'gt' | 'gte' | 'lt' | 'lte',
): boolean {
  const x = typeof a === 'string' ? Number(a) : a
  const y = typeof b === 'string' ? Number(b) : b
  if (typeof x !== 'number' || typeof y !== 'number') return false
  if (Number.isNaN(x) || Number.isNaN(y)) return false
  switch (op) {
    case 'gt':
      return x > y
    case 'gte':
      return x >= y
    case 'lt':
      return x < y
    case 'lte':
      return x <= y
  }
}

/**
 * Evaluate an expression against a record's data. Total: an expression that
 * references a missing field is false, never a throw, because specs and records
 * drift across versions by design.
 */
export function evaluate(expr: Expr | null | undefined, data: Data): boolean {
  if (!expr) return true
  if ('eq' in expr) {
    const [a, b] = expr.eq
    return resolve(a, data) === resolve(b, data)
  }
  if ('gt' in expr) return compare(resolve(expr.gt[0], data), resolve(expr.gt[1], data), 'gt')
  if ('gte' in expr) return compare(resolve(expr.gte[0], data), resolve(expr.gte[1], data), 'gte')
  if ('lt' in expr) return compare(resolve(expr.lt[0], data), resolve(expr.lt[1], data), 'lt')
  if ('lte' in expr) return compare(resolve(expr.lte[0], data), resolve(expr.lte[1], data), 'lte')
  if ('isSet' in expr) return !isEmpty(resolve(expr.isSet, data))
  if ('and' in expr) return expr.and.every((e) => evaluate(e, data))
  if ('or' in expr) return expr.or.some((e) => evaluate(e, data))
  if ('not' in expr) return !evaluate(expr.not, data)
  return false
}

function fieldLabel(key: string, fields: Field[]): string {
  return fields.find((f) => f.key === key)?.label ?? key
}

function formatOperand(operand: Operand, fields: Field[]): string {
  if (typeof operand === 'string') return fieldLabel(operand, fields)
  const v = operand.value
  if (v === null) return 'nothing'
  if (typeof v === 'number') return v.toLocaleString('en-US')
  return String(v)
}

/**
 * Render an expression as English for the Program screen and provenance panel.
 * Money formatting is inferred from the field type of the left operand.
 */
export function describe(
  expr: Expr | null | undefined,
  spec: Pick<Spec, 'fields'>,
): string {
  if (!expr) return 'Always'
  const fields = spec.fields
  const money = (operand: Operand, other: Operand) => {
    const key = typeof other === 'string' ? other : null
    const isMoney = key ? fields.find((f) => f.key === key)?.type === 'money' : false
    if (isMoney && typeof operand !== 'string' && typeof operand.value === 'number') {
      return `$${operand.value.toLocaleString('en-US')}`
    }
    return formatOperand(operand, fields)
  }
  const binary = (
    pairOp: [Operand, Operand],
    word: string,
  ) => `${money(pairOp[0], pairOp[1])} is ${word} ${money(pairOp[1], pairOp[0])}`

  if ('eq' in expr) return binary(expr.eq, 'exactly')
  if ('gt' in expr) return binary(expr.gt, 'greater than')
  if ('gte' in expr) return binary(expr.gte, 'at least')
  if ('lt' in expr) return binary(expr.lt, 'less than')
  if ('lte' in expr) return binary(expr.lte, 'at most')
  if ('isSet' in expr) return `${formatOperand(expr.isSet, fields)} is set`
  if ('and' in expr) return expr.and.map((e) => describe(e, spec)).join(' and ')
  if ('or' in expr) return expr.or.map((e) => describe(e, spec)).join(' or ')
  if ('not' in expr) return `not (${describe(expr.not, spec)})`
  return 'Unknown condition'
}
