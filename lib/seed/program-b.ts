import type { Spec } from '@/lib/spec/types'

/**
 * Program B, hand-authored from `samples/startup-lump-sum-grant/program-contract.md`.
 *
 * A second program with a genuinely different shape — three states rather than
 * five, a single payment rather than staged release, no counter-signature, and
 * a tighter clock — which is the thing that proves the engine is generic. One
 * spec interpreter, two programs, one queue.
 *
 * Clause references and quotes are taken from the real sample document, so
 * provenance on this program resolves to sentences somebody can go and read.
 */

const DOC = 'program-contract.md'

/** What the spreadsheet alone gives you, before the agreement is applied. */
export const programBv1: Spec = {
  name: 'Startup Lump Sum Grant',
  entity: 'Award',
  fields: [
    { key: 'recipient', label: 'Recipient', type: 'text', required: true, requiredFrom: null, options: null, source: null },
    { key: 'amount', label: 'Award amount', type: 'money', required: true, requiredFrom: null, options: null, source: null },
    { key: 'decision_date', label: 'Decision date', type: 'date', required: true, requiredFrom: null, options: null, source: null },
    { key: 'contact', label: 'Contact', type: 'text', required: false, requiredFrom: null, options: null, source: null },
  ],
  states: ['new', 'active', 'closed'],
  initial: 'new',
  transitions: [
    { id: 'start', from: 'new', to: 'active', label: 'Start', role: 'program_officer', guard: null, source: null },
    { id: 'finish', from: 'active', to: 'closed', label: 'Close', role: 'program_officer', guard: null, source: null },
  ],
  rules: [],
  clocks: [],
  unresolved: [],
}

export const programBv2: Spec = {
  name: 'Startup Lump Sum Grant',
  entity: 'Award',
  fields: [
    ...programBv1.fields,
    {
      key: 'receipt_confirmed',
      label: 'Receipt confirmed',
      type: 'checkbox',
      required: true,
      requiredFrom: 'paid',
      options: null,
      source: {
        document: DOC,
        clause: '§3.4',
        quote:
          'An Award shall be closed by the Program Officer once payment has been issued and the recipient has confirmed receipt.',
      },
    },
    { key: 'notes', label: 'Notes', type: 'textarea', required: false, requiredFrom: null, options: null, source: null },
  ],
  states: ['approved', 'payment_pending', 'paid', 'closed'],
  initial: 'approved',
  transitions: [
    {
      id: 'queue_payment',
      from: 'approved',
      to: 'payment_pending',
      label: 'Queue for payment',
      role: 'program_officer',
      guard: { gt: ['amount', { value: 0 }] },
      source: {
        document: DOC,
        clause: '§3.1',
        quote:
          'Upon approval of an Award, the Program Officer shall queue it for payment. An Award moves from approved to payment pending.',
      },
    },
    {
      id: 'issue_payment',
      from: 'payment_pending',
      to: 'paid',
      label: 'Issue payment',
      role: 'finance',
      guard: null,
      source: {
        document: DOC,
        clause: '§3.2',
        quote:
          'Finance shall issue the payment in full. Upon issue, the Award moves from payment pending to paid.',
      },
    },
    {
      id: 'close_award',
      from: 'paid',
      to: 'closed',
      label: 'Close award',
      role: 'program_officer',
      guard: { isSet: 'receipt_confirmed' },
      source: {
        document: DOC,
        clause: '§3.4',
        quote:
          'An Award shall be closed by the Program Officer once payment has been issued and the recipient has confirmed receipt.',
      },
    },
  ],
  rules: [],
  clocks: [
    {
      id: 'payment_slo',
      label: 'Payment SLO',
      fromState: 'payment_pending',
      days: 5,
      warnAt: 3,
      ownerRole: 'finance',
      source: {
        document: DOC,
        clause: '§5.1',
        quote:
          'Payment shall be issued to the recipient within five (5) days of the Award being queued for payment. Where three days have elapsed without payment, the matter shall be escalated to the Finance lead.',
      },
    },
  ],
  unresolved: [
    {
      id: 'award_ceiling',
      summary:
        'No Award may exceed $25,000, but the agreement does not say what happens to one that does — whether it is rejected, reduced, or escalated.',
      source: {
        document: DOC,
        clause: '§4.2',
        quote:
          'No Award under this program shall exceed twenty-five thousand dollars ($25,000).',
      },
    },
    {
      id: 'approval_notification',
      summary:
        'Recipients must be notified of approval within five days, but notification is not recorded against an Award, so nothing can tell whether it happened.',
      source: {
        document: DOC,
        clause: '§5.2',
        quote: 'Recipients shall be notified of approval within five days of the decision.',
      },
    },
  ],
}
