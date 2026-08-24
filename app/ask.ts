'use server'

import { generateText } from 'ai'
import { attention } from '@/lib/engine/attention'
import { extractionModel } from '@/lib/ingest/model'
import { getPrograms, getRecords, toContexts } from '@/lib/queries'
import { currentRole } from '@/lib/roles'
import { describe } from '@/lib/spec/expr'
import { money } from '@/lib/format'
import { ROLE_LABELS, ROLE_PEOPLE } from '@/lib/spec/types'

export type AskResult = { question: string; answer: string | null; error: string | null }

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
    const [role, programs, records] = await Promise.all([
      currentRole(),
      getPrograms(),
      getRecords(),
    ])
    const items = attention(toContexts(programs), records, new Date())

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
      '# Grants',
      ...records.map((r) => {
        const p = programs.find((x) => x.id === r.programId)
        const spec = p?.versions.find((v) => v.version === r.specVersion)?.spec
        const title = spec?.fields.find((f) => f.type === 'text')?.key
        const amount = spec?.fields.find((f) => f.type === 'money')?.key
        return `${r.ref} | ${title ? r.data[title] : ''} | ${p?.name} | ${r.state} | ${amount ? money(r.data[amount]) : ''} | spec v${r.specVersion}`
      }),
      '',
      '# Currently needing attention',
      ...items.map(
        (i) =>
          `${i.reason} | ${i.headline} | ${i.subline} | owner ${i.ownerRole ? ROLE_LABELS[i.ownerRole] : 'unassigned'} | ${i.ageLabel}`,
      ),
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
- You cannot change anything. If asked to act, say what the person should do instead.`,
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
