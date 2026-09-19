'use server'

import { generateText } from 'ai'
import { extractionModel } from '@/lib/ingest/model'
import {
  countRecords,
  getQueue,
  getPrograms,
  getRecordPage,
  getStateCounts,
} from '@/lib/queries'
import { currentRole } from '@/lib/roles'
import { describe } from '@/lib/spec/expr'
import { money } from '@/lib/format'
import { ROLE_LABELS, ROLE_PEOPLE } from '@/lib/spec/types'

export type AskResult = { question: string; answer: string | null; error: string | null }

/** What fits in a prompt without the answer quality falling off a cliff. */
const SNAPSHOT_ITEMS = 60
const SNAPSHOT_RECORDS = 40

/**
 * Answer a question about what is currently in the system.
 *
 * The model is given a compact snapshot and told to answer only from it. It is
 * a reader, not an actor: there are no tools on this call, so the worst a bad
 * answer can do is be wrong on screen, never move money or change a rule.
 */
export async function askQuestion(
  _prev: AskResult | null,
  formData: FormData,
): Promise<AskResult> {
  const question = String(formData.get('question') ?? '').trim()
  if (!question) return { question, answer: null, error: null }

  try {
    const role = await currentRole()

    // A snapshot has to fit in a prompt, so it is built from the queue and from
    // counts rather than from every grant in flight. The model is told what it
    // is not being shown, which is the difference between a bounded answer and
    // a confidently wrong one.
    const [programs, items, stateCounts, total, recent] = await Promise.all([
      getPrograms(),
      getQueue({ role, limit: SNAPSHOT_ITEMS }),
      getStateCounts(),
      countRecords(),
      getRecordPage({ limit: SNAPSHOT_RECORDS }),
    ])

    const snapshot = [
      `Today is ${new Date().toDateString()}. You are answering ${ROLE_PEOPLE[role]}, ${ROLE_LABELS[role]}.`,
      '',
      '# Programs',
      ...programs.map((p) =>
        [
          `${p.name} (v${p.currentVersion}, ${p.entity})`,
          `  states: ${p.currentSpec.states.join(' -> ')}`,
          ...p.currentSpec.rules.map(
            (r) =>
              `  rule ${r.label}: when ${describe(r.when, p.currentSpec)} requires ${r.require.join(', ')} (${r.source?.clause ?? 'no clause'})`,
          ),
          ...p.currentSpec.clocks.map(
            (c) =>
              `  clock ${c.label}: ${c.days} days from ${c.fromState}, warn at ${c.warnAt} (${c.source?.clause ?? 'no clause'})`,
          ),
        ].join('\n'),
      ),
      '',
      '# How many grants are where',
      `${total} in total.`,
      ...programs.map((p) => {
        const byState = stateCounts.get(p.id) ?? new Map<string, number>()
        const parts = p.currentSpec.states.map((s) => `${s}: ${byState.get(s) ?? 0}`)
        return `${p.name} — ${parts.join(', ')}`
      }),
      '',
      `# Currently needing attention (${items.length} shown, highest priority first)`,
      ...items.map(
        (i) =>
          `${i.reason} | ${i.headline} | ${i.subline} | owner ${i.ownerRole ? ROLE_LABELS[i.ownerRole] : 'unassigned'} | ${i.ageLabel}`,
      ),
      '',
      `# Most recently touched grants (${recent.length} of ${total})`,
      ...recent.map((r) => {
        const p = programs.find((x) => x.id === r.programId)
        const spec = p?.versions.find((v) => v.version === r.specVersion)?.spec
        const title = spec?.fields.find((f) => f.type === 'text')?.key
        const amount = spec?.fields.find((f) => f.type === 'money')?.key
        return `${r.ref} | ${title ? r.data[title] : ''} | ${p?.name} | ${r.state} | ${amount ? money(r.data[amount]) : ''} | spec v${r.specVersion}`
      }),
    ].join('\n')

    const { text } = await generateText({
      model: extractionModel(),
      abortSignal: AbortSignal.timeout(45_000),
      system: `You answer questions about a grant administration system from a snapshot of its
current state. Rules:
- Answer ONLY from the snapshot. If it does not contain the answer, say so plainly.
- Be short: two or three sentences, or a small list. No preamble.
- Name specific records and amounts rather than talking in generalities.
- Cite the clause when a rule or a deadline is the reason for something.
- You cannot change anything. If asked to act, say what the person should do instead.
- The snapshot is a sample, not the whole database: it holds the top of the
  attention queue, per-state counts, and the most recently touched grants. If a
  question needs a grant that is not listed, say which screen would answer it
  rather than guessing or implying the list is complete.`,
      prompt: `${snapshot}\n\n---\n\nQuestion: ${question}`,
    })

    return { question, answer: text.trim(), error: null }
  } catch (error) {
    return {
      question,
      answer: null,
      error:
        error instanceof Error
          ? `Could not answer that: ${error.message}`
          : 'Could not answer that.',
    }
  }
}
