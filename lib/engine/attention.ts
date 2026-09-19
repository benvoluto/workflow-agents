import { evaluate } from '@/lib/spec/expr'
import {
  evidenceOverrideFor,
  forwardTransitions,
  missingRequiredFields,
  signatureFor,
  unmetRules,
  type InlineAction,
  type RecordLike,
} from './runtime'
import type { Clock, Role, Spec } from '@/lib/spec/types'

export type Urgency = 'overdue' | 'due_soon' | 'blocked' | 'change'

export type AttentionItem = {
  id: string
  urgency: Urgency
  reason: string
  headline: string
  subline: string
  ownerRole: Role | null
  recordId: string | null
  recordRef: string | null
  programId: string
  programName: string
  amount: number | null
  dueAt: Date | null
  ageLabel: string
  /** The clause this item traces to, for the explanation panel. */
  evidence: { document: string; clause: string; quote: string } | null
  /** What would take this item out of the queue. */
  resolution: string
  /**
   * The one thing that can be done about this item from the queue itself,
   * when there is exactly one and it is unambiguous who it belongs to.
   * Null on everything else, which is most items.
   */
  action: InlineAction | null
  /** Lower sorts first within a group. */
  sortKey: number
}

export type ProgramContext = {
  programId: string
  programName: string
  currentVersion: number
  currentSpec: Spec
  specByVersion: Record<number, Spec>
}

const DAY = 24 * 60 * 60 * 1000

function startOfDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Calendar days between two instants, not elapsed 24-hour periods.
 *
 * This is how people read a deadline: something due on the 25th is "2 days
 * left" all day on the 23rd. Flooring elapsed milliseconds instead would make
 * the same record drift from "2 days left" to "1 day left" partway through an
 * afternoon, and would make seeded demo data slip by a day within minutes.
 *
 * It also has a structural consequence the rest of the system leans on: `now`
 * reaches every urgency test, every sort key and every label through this
 * function alone, so for a fixed set of records and specs the queue can only
 * change at UTC midnight. See `lib/engine/wake.ts`.
 */
function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY)
}

function titleOf(spec: Spec, record: RecordLike): string {
  const textField = spec.fields.find((f) => f.type === 'text')
  const v = textField ? record.data[textField.key] : null
  return typeof v === 'string' && v ? v : record.ref
}

function amountOf(spec: Spec, record: RecordLike): number | null {
  const moneyField = spec.fields.find((f) => f.type === 'money')
  if (!moneyField) return null
  const v = record.data[moneyField.key]
  return typeof v === 'number' ? v : null
}

function dueDate(clock: Clock, record: RecordLike): Date {
  return new Date(record.stateEnteredAt.getTime() + clock.days * DAY)
}

function overdueLabel(days: number): string {
  if (days === 0) return 'due today'
  if (days === 1) return '1 day over'
  return `${days} days over`
}

function remainingLabel(days: number): string {
  if (days === 0) return 'due today'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

export const URGENCY_ORDER: Urgency[] = ['overdue', 'due_soon', 'blocked', 'change']

/** Sort position of an urgency band. Stored alongside cached rows so the
 *  database can order a materialised queue exactly the way the engine would. */
export function rankOf(urgency: Urgency): number {
  return URGENCY_ORDER.indexOf(urgency)
}

/** The engine's ordering, as a standalone function so a cached read can reuse it. */
export function sortItems(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => {
    const d = rankOf(a.urgency) - rankOf(b.urgency)
    return d !== 0 ? d : a.sortKey - b.sortKey
  })
}

/**
 * Everything one record has to say, judged against the spec version it is
 * pinned to rather than the newest one.
 *
 * Split out of `attention` so a single write can recompute a single record
 * without touching the rest of the program. The result is identical to the
 * slice this record contributes to a full run.
 */
export function attentionForRecord(
  ctx: ProgramContext,
  record: RecordLike,
  now: Date,
): AttentionItem[] {
  const items: AttentionItem[] = []
  const spec = ctx.specByVersion[record.specVersion] ?? ctx.currentSpec
  const title = titleOf(spec, record)
  const amount = amountOf(spec, record)
  const base = {
    recordId: record.id,
    recordRef: record.ref,
    programId: ctx.programId,
    programName: ctx.programName,
    amount,
    action: null as InlineAction | null,
  }

  // 1. Clocks — breach or approach.
  for (const clock of spec.clocks) {
    if (clock.fromState !== record.state) continue
    const due = dueDate(clock, record)
    const elapsed = daysBetween(record.stateEnteredAt, now)
    const remaining = daysBetween(now, due)
    if (remaining < 0) {
      items.push({
        ...base,
        id: `${record.id}:clock:${clock.id}:breach`,
        urgency: 'overdue',
        reason: 'Clock breach',
        headline: `${title}: ${clock.label} breached`,
        subline: `${clock.label} of ${clock.days} days breached, ${overdueLabel(-remaining)}. Due ${fmtDate(due)}`,
        ownerRole: clock.ownerRole,
        dueAt: due,
        ageLabel: overdueLabel(-remaining),
        evidence: clock.source,
        resolution: `Moving this ${program(ctx)} out of ${prettyState(record.state)} stops the clock.`,
        sortKey: remaining,
      })
    } else if (elapsed >= clock.warnAt) {
      items.push({
        ...base,
        id: `${record.id}:clock:${clock.id}:warn`,
        urgency: 'due_soon',
        reason: 'Clock warning',
        headline: `${title}: ${clock.label} due soon`,
        subline: `Day ${elapsed} of ${clock.days}, ${remainingLabel(remaining)}. Due ${fmtDate(due)}`,
        ownerRole: clock.ownerRole,
        dueAt: due,
        ageLabel: remainingLabel(remaining),
        evidence: clock.source,
        resolution: `Moving this ${program(ctx)} out of ${prettyState(record.state)} before ${fmtDate(due)} stops the clock.`,
        sortKey: remaining,
      })
    }
  }

  // 2. Blocked — a rule holds and nobody has satisfied it.
  for (const rule of unmetRules(spec, record)) {
    const needed = rule.require
      .map((key) => spec.fields.find((f) => f.key === key)?.label ?? key)
      .join(', ')
    const clause = rule.source ? ` · ${rule.source.clause}` : ''
    items.push({
      ...base,
      id: `${record.id}:rule:${rule.id}`,
      urgency: 'blocked',
      reason: 'Awaiting approval',
      headline: `${title}: awaiting ${needed}`,
      subline: `${rule.label} requires ${needed}, unrecorded for ${daysBetween(record.stateEnteredAt, now)} days${clause}`,
      ownerRole: rule.role ?? null,
      dueAt: null,
      ageLabel: `waiting ${daysBetween(record.stateEnteredAt, now)} days`,
      evidence: rule.source,
      resolution: `Recording ${needed} clears this.`,
      action: signatureFor(spec, rule, record),
      sortKey: -daysBetween(record.stateEnteredAt, now),
    })
  }

  // 3. Incomplete — a required field is empty and the record wants to move.
  const missing = missingRequiredFields(spec, record)
  const forward = forwardTransitions(spec, record)
  if (missing.length > 0 && forward.length > 0) {
    const names = missing.map((f) => f.label).join(', ')
    items.push({
      ...base,
      id: `${record.id}:incomplete`,
      urgency: 'blocked',
      reason: 'Missing information',
      headline: `${title}: ${names} missing`,
      subline: `Cannot leave ${prettyState(record.state)} until ${names} ${missing.length === 1 ? 'is' : 'are'} filled`,
      ownerRole: forward[0]?.role ?? null,
      dueAt: null,
      ageLabel: `${daysBetween(record.stateEnteredAt, now)}d in state`,
      evidence: missing[0]?.source ?? null,
      resolution: `Filling in ${names} lets this move on.`,
      action: evidenceOverrideFor(spec, record),
      sortKey: -daysBetween(record.stateEnteredAt, now),
    })
  }

  return items
}

/**
 * One program's whole contribution to the queue.
 *
 * `attention` is exactly this, mapped over the programs and sorted — the record
 * loop never reads across programs, and change impact is already scoped to one.
 * That makes the split safe to rely on: recomputing a program in isolation
 * cannot produce a different answer from recomputing everything.
 */
export function attentionForProgram(
  ctx: ProgramContext,
  records: RecordLike[],
  now: Date,
): AttentionItem[] {
  const mine = records.filter((r) => r.programId === ctx.programId)
  const items: AttentionItem[] = []
  for (const record of mine) items.push(...attentionForRecord(ctx, record, now))

  const behind = mine.filter((r) => r.specVersion < ctx.currentVersion)
  if (behind.length > 0) items.push(...changeImpactFor(ctx, behind, now))

  return items
}

/**
 * The whole differentiator, as one pure function over spec + records + now.
 *
 * Kept as the definition of truth. Nothing writes a queue row that this
 * function did not produce, and `verifyQueue` re-runs it against the cache to
 * prove the two still agree.
 */
export function attention(
  programs: ProgramContext[],
  records: RecordLike[],
  now: Date,
): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const ctx of programs) items.push(...attentionForProgram(ctx, records, now))
  return sortItems(items)
}

/**
 * Difference the pinned spec against the current one, per record, and report
 * only causes that change an answer: a rule that newly binds, or a clock whose
 * deadline moves. Rules that already applied are not news.
 */
export function changeImpactFor(
  ctx: ProgramContext,
  behind: RecordLike[],
  now: Date,
): AttentionItem[] {
  const out: AttentionItem[] = []
  const current = ctx.currentSpec

  for (const rule of current.rules) {
    const affected = behind.filter((r) => {
      const old = ctx.specByVersion[r.specVersion]
      const oldRule = old?.rules.find((x) => x.id === rule.id)
      const boundBefore = oldRule ? evaluate(oldRule.when, r.data) : false
      const boundNow = evaluate(rule.when, r.data)
      return boundNow && !boundBefore
    })
    if (affected.length === 0) continue
    out.push({
      id: `${ctx.programId}:impact:rule:${rule.id}`,
      urgency: 'change',
      reason: 'Change impact',
      headline: `${affected.length} in-flight ${affected.length === 1 ? 'grant' : 'grants'} would newly require ${rule.label.toLowerCase()}`,
      subline: `${ctx.programName} v${ctx.currentVersion}${rule.source ? ` · ${rule.source.clause}` : ''} — ${summariseRefs(affected)}`,
      ownerRole: rule.role ?? null,
      recordId: null,
      recordRef: null,
      programId: ctx.programId,
      programName: ctx.programName,
      amount: null,
      dueAt: null,
      ageLabel: `${affected.length} affected`,
      evidence: rule.source,
      resolution: `Moving these grants to v${ctx.currentVersion} applies the new rule to them.`,
      action: null,
      sortKey: -affected.length,
    })
  }

  for (const clock of current.clocks) {
    const affected = behind.filter((r) => {
      if (r.state !== clock.fromState) return false
      const old = ctx.specByVersion[r.specVersion]
      const oldClock = old?.clocks.find((x) => x.id === clock.id)
      if (!oldClock || oldClock.days === clock.days) return false
      const wasOverdue = daysBetween(r.stateEnteredAt, now) > oldClock.days
      const isOverdue = daysBetween(r.stateEnteredAt, now) > clock.days
      return isOverdue && !wasOverdue
    })
    if (affected.length === 0) continue
    out.push({
      id: `${ctx.programId}:impact:clock:${clock.id}`,
      urgency: 'change',
      reason: 'Change impact',
      headline: `${affected.length} in-flight ${affected.length === 1 ? 'grant is' : 'grants are'} immediately overdue`,
      subline: `${clock.label} tightened to ${clock.days} days${clock.source ? ` · ${clock.source.clause}` : ''} — ${summariseRefs(affected)}`,
      ownerRole: clock.ownerRole,
      recordId: null,
      recordRef: null,
      programId: ctx.programId,
      programName: ctx.programName,
      amount: null,
      dueAt: null,
      ageLabel: `${affected.length} affected`,
      evidence: clock.source,
      resolution: `Moving these grants to v${ctx.currentVersion} applies the tighter window to them.`,
      action: null,
      sortKey: -affected.length,
    })
  }

  return out
}

/**
 * Name the affected records, up to the point where naming them stops helping.
 *
 * At twelve awards the full list is the useful sentence. At a thousand it is a
 * paragraph nobody reads and a row too wide to render, so past a handful it
 * becomes a count and the program page carries the rest.
 */
const REFS_SHOWN = 6

function summariseRefs(affected: RecordLike[]): string {
  const refs = affected.slice(0, REFS_SHOWN).map((r) => r.ref).join(', ')
  const rest = affected.length - REFS_SHOWN
  return rest > 0 ? `${refs} and ${rest} more` : refs
}

function program(ctx: ProgramContext): string {
  return ctx.currentSpec?.entity?.toLowerCase() ?? 'record'
}

function prettyState(state: string): string {
  return state.replace(/_/g, ' ')
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export const URGENCY_LABELS: Record<Urgency, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  blocked: 'Blocked',
  change: 'Affected by a change',
}

/**
 * Whether a queue item belongs in a given role's view.
 *
 * The Program Officer runs the program and sees all of it, with each item
 * naming whoever owes the next move — that is the coordinating job. Finance and
 * the CFO see only what is actually theirs, because for them a full queue would
 * be noise they cannot act on.
 */
export function visibleTo(item: AttentionItem, role: Role): boolean {
  if (role === 'program_officer') return true
  return item.ownerRole === null || item.ownerRole === role
}
