import { evaluate } from '@/lib/spec/expr'
import {
  forwardTransitions,
  missingRequiredFields,
  unmetRules,
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

/**
 * The whole differentiator, as one pure function over spec + records + now.
 *
 * Recomputed on every page load. At demo scale that is free, and it means the
 * queue can never drift out of sync with the data the way a materialised one can.
 */
export function attention(
  programs: ProgramContext[],
  records: RecordLike[],
  now: Date,
): AttentionItem[] {
  const items: AttentionItem[] = []
  const byId = new Map(programs.map((p) => [p.programId, p]))

  for (const record of records) {
    const ctx = byId.get(record.programId)
    if (!ctx) continue
    // Evaluate against the version this record is pinned to, not the newest.
    const spec = ctx.specByVersion[record.specVersion] ?? ctx.currentSpec
    const title = titleOf(spec, record)
    const amount = amountOf(spec, record)
    const base = {
      recordId: record.id,
      recordRef: record.ref,
      programId: ctx.programId,
      programName: ctx.programName,
      amount,
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
          headline: `${title} — ${prettyState(record.state)} for ${elapsed} days`,
          subline: `${clock.label} of ${clock.days} days breached · due ${fmtDate(due)}`,
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
          headline: `${title} — ${prettyState(record.state)} for ${elapsed} days`,
          subline: `Day ${elapsed} of ${clock.days} · due ${fmtDate(due)}`,
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
        headline: `${title} — awaiting ${needed}`,
        subline: `Needs ${needed}${clause}`,
        ownerRole: rule.role ?? null,
        dueAt: null,
        ageLabel: `waiting ${daysBetween(record.stateEnteredAt, now)} days`,
        evidence: rule.source,
        resolution: `Recording ${needed} clears this.`,
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
        headline: `${title} — ${names} ${missing.length === 1 ? 'is' : 'are'} missing`,
        subline: `Cannot leave ${prettyState(record.state)} until ${names} ${missing.length === 1 ? 'is' : 'are'} filled`,
        ownerRole: forward[0]?.role ?? null,
        dueAt: null,
        ageLabel: `${daysBetween(record.stateEnteredAt, now)}d in state`,
        evidence: missing[0]?.source ?? null,
        resolution: `Filling in ${names} lets this move on.`,
        sortKey: -daysBetween(record.stateEnteredAt, now),
      })
    }
  }

  // 4. Change impact — records pinned behind the current version that the newer
  //    spec would treat differently. Grouped per program per cause, because
  //    "5 awards would become overdue" is the useful sentence, not five rows.
  for (const ctx of programs) {
    const behind = records.filter(
      (r) => r.programId === ctx.programId && r.specVersion < ctx.currentVersion,
    )
    if (behind.length === 0) continue
    for (const item of changeImpact(ctx, behind, now)) items.push(item)
  }

  return items.sort((a, b) => {
    const order: Urgency[] = ['overdue', 'due_soon', 'blocked', 'change']
    const d = order.indexOf(a.urgency) - order.indexOf(b.urgency)
    return d !== 0 ? d : a.sortKey - b.sortKey
  })
}

/**
 * Difference the pinned spec against the current one, per record, and report
 * only causes that change an answer: a rule that newly binds, or a clock whose
 * deadline moves. Rules that already applied are not news.
 */
function changeImpact(
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
      headline: `${affected.length} in-flight ${affected.length === 1 ? 'record' : 'records'} would newly require ${rule.label.toLowerCase()}`,
      subline: `${ctx.programName} v${ctx.currentVersion}${rule.source ? ` · ${rule.source.clause}` : ''} — ${affected
        .map((r) => r.ref)
        .join(', ')}`,
      ownerRole: rule.role ?? null,
      recordId: null,
      recordRef: null,
      programId: ctx.programId,
      programName: ctx.programName,
      amount: null,
      dueAt: null,
      ageLabel: `${affected.length} affected`,
      evidence: rule.source,
      resolution: `Moving these records to v${ctx.currentVersion} applies the new rule to them.`,
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
      headline: `${affected.length} in-flight ${affected.length === 1 ? 'record is' : 'records are'} immediately overdue`,
      subline: `${clock.label} tightened to ${clock.days} days${clock.source ? ` · ${clock.source.clause}` : ''} — ${affected
        .map((r) => r.ref)
        .join(', ')}`,
      ownerRole: clock.ownerRole,
      recordId: null,
      recordRef: null,
      programId: ctx.programId,
      programName: ctx.programName,
      amount: null,
      dueAt: null,
      ageLabel: `${affected.length} affected`,
      evidence: clock.source,
      resolution: `Moving these records to v${ctx.currentVersion} applies the tighter window to them.`,
      sortKey: -affected.length,
    })
  }

  return out
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
