import type { Spec } from '@/lib/spec/types'

/**
 * Program A is pre-seeded so the app has something to say the moment it opens.
 *
 * The specs here are hand-authored rather than extracted at seed time on
 * purpose: the demo needs a known starting state, and the live extractor is
 * exercised by the amendment (step 4) and Program B (step 5), which are the
 * beats that actually matter.
 */

const DOC = 'program-contract.md'

/** What a spreadsheet alone can tell you: shape, and a placeholder lifecycle. */
export const programAv1: Spec = {
  name: 'Milestone Facilities Grant',
  entity: 'Award',
  fields: [
    { key: 'provider', label: 'Provider', type: 'text', required: true, requiredFrom: null, options: null, source: null },
    { key: 'amount', label: 'Award amount', type: 'money', required: true, requiredFrom: null, options: null, source: null },
    { key: 'approval_date', label: 'Approval date', type: 'date', required: true, requiredFrom: null, options: null, source: null },
    { key: 'milestone_count', label: 'Milestone count', type: 'number', required: true, requiredFrom: null, options: null, source: null },
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

/** What the program agreement adds: a real lifecycle, a control, and a clock. */
export const programAv2: Spec = {
  name: 'Milestone Facilities Grant',
  entity: 'Award',
  fields: [
    ...programAv1.fields,
    {
      key: 'evidence_url',
      label: 'Evidence URL',
      type: 'url',
      required: true,
      requiredFrom: 'evidence_review',
      options: null,
      source: {
        document: DOC,
        clause: '§4.5',
        quote:
          'Where an Award carries one or more Milestones, evidence of completion shall be recorded against the Award before it may be marked as paid. Evidence shall be furnished as a durable link to the provider’s documentation.',
      },
    },
    {
      key: 'cfo_signature',
      label: 'CFO signature',
      type: 'signature',
      required: false,
      requiredFrom: null,
      options: null,
      source: {
        document: DOC,
        clause: '§4.2',
        quote:
          'Any disbursement in excess of fifty thousand dollars ($50,000) shall require the counter-signature of the Chief Financial Officer, recorded prior to release of funds.',
      },
    },
    { key: 'notes', label: 'Notes', type: 'textarea', required: false, requiredFrom: null, options: null, source: null },
  ],
  states: ['approved', 'tranche_pending', 'evidence_review', 'paid', 'closed'],
  initial: 'approved',
  transitions: [
    {
      id: 'release_tranche',
      from: 'approved',
      to: 'tranche_pending',
      label: 'Release tranche',
      role: 'program_officer',
      guard: { gt: ['amount', { value: 0 }] },
      source: {
        document: DOC,
        clause: '§3.1',
        quote:
          'Upon approval of an Award, the Program Officer may release the first tranche. An Award moves from approved to tranche pending at the point of release.',
      },
    },
    {
      id: 'mark_disbursed',
      from: 'tranche_pending',
      to: 'evidence_review',
      label: 'Mark disbursed',
      role: 'finance',
      guard: null,
      source: {
        document: DOC,
        clause: '§3.4',
        quote:
          'Once funds have been transmitted to the provider, Finance shall record the disbursement, and the Award moves from tranche pending to evidence review.',
      },
    },
    {
      id: 'accept_evidence',
      from: 'evidence_review',
      to: 'paid',
      label: 'Accept evidence',
      role: 'program_officer',
      guard: { isSet: 'evidence_url' },
      source: {
        document: DOC,
        clause: '§3.6',
        quote:
          'Where the Program Officer accepts the evidence furnished, the Award moves from evidence review to paid.',
      },
    },
    {
      id: 'close_award',
      from: 'paid',
      to: 'closed',
      label: 'Close award',
      role: 'program_officer',
      guard: null,
      source: {
        document: DOC,
        clause: '§6.1',
        quote:
          'An Award shall be closed by the Program Officer once all Milestones have been paid and all evidence has been accepted.',
      },
    },
  ],
  rules: [
    {
      id: 'dual_signature',
      label: 'Dual signature',
      when: { gt: ['amount', { value: 50000 }] },
      require: ['cfo_signature'],
      role: 'cfo',
      source: {
        document: DOC,
        clause: '§4.2',
        quote:
          'Any disbursement in excess of fifty thousand dollars ($50,000) shall require the counter-signature of the Chief Financial Officer, recorded prior to release of funds.',
      },
    },
  ],
  clocks: [
    {
      id: 'disbursement_slo',
      label: 'Disbursement SLO',
      fromState: 'tranche_pending',
      days: 10,
      warnAt: 7,
      ownerRole: 'finance',
      source: {
        document: DOC,
        clause: '§5.4',
        quote:
          'Funds shall be released to the provider within ten (10) days of the tranche being authorised. Where seven days have elapsed without release, the matter shall be escalated to the Finance lead.',
      },
    },
  ],
  unresolved: [],
}

export type SeedRecord = {
  ref: string
  state: string
  /** Days before "now" that the record entered its current state. */
  enteredDaysAgo: number
  data: Record<string, unknown>
}

const sig = (name: string, daysAgo: number) => `Priya Raman, ${daysAgo}d ago`

/**
 * Twelve awards, positioned so that every branch of the attention engine has
 * something in it on first load, and so that the amendment in step 4 lands on
 * real in-flight work rather than on nothing.
 */
export const programARecords: SeedRecord[] = [
  {
    // The hero: blocked on a signature, clock warning, and the one the
    // amendment tips into overdue.
    ref: 'AWD-1041',
    state: 'tranche_pending',
    enteredDaysAgo: 8,
    data: {
      provider: 'Northgate Community Trust',
      amount: 61400,
      approval_date: '2026-08-02',
      milestone_count: 3,
      contact: 'a.mercer@northgatetrust.org',
      evidence_url: null,
      cfo_signature: null,
      notes:
        'Site handover slipped a week; provider confirmed revised schedule by email.',
    },
  },
  {
    ref: 'AWD-1042',
    state: 'tranche_pending',
    enteredDaysAgo: 19,
    data: {
      provider: 'Riverbend Housing Collective',
      amount: 148000,
      approval_date: '2026-07-24',
      milestone_count: 4,
      contact: 'ops@riverbendhousing.org',
      evidence_url: null,
      cfo_signature: sig('Riverbend', 20),
      notes: null,
    },
  },
  {
    ref: 'AWD-1043',
    state: 'evidence_review',
    enteredDaysAgo: 12,
    data: {
      provider: 'Cedar Hollow Youth Services',
      amount: 24750,
      approval_date: '2026-07-30',
      milestone_count: 2,
      contact: 'finance@cedarhollow.org',
      evidence_url: 'https://cedarhollow.org/grants/milestone-1',
      cfo_signature: null,
      notes: null,
    },
  },
  {
    ref: 'AWD-1044',
    state: 'tranche_pending',
    enteredDaysAgo: 11,
    data: {
      provider: 'Ashfield Works',
      amount: 92000,
      approval_date: '2026-07-28',
      milestone_count: 3,
      contact: 'grants@ashfieldworks.co',
      evidence_url: null,
      cfo_signature: sig('Ashfield', 12),
      notes: null,
    },
  },
  {
    ref: 'AWD-1045',
    state: 'paid',
    enteredDaysAgo: 17,
    data: {
      provider: 'Portside Learning Alliance',
      amount: 18200,
      approval_date: '2026-07-21',
      milestone_count: 1,
      contact: 'hello@portsidelearning.org',
      evidence_url: 'https://portsidelearning.org/reports/fitout.pdf',
      cfo_signature: null,
      notes: null,
    },
  },
  {
    ref: 'AWD-1046',
    state: 'tranche_pending',
    enteredDaysAgo: 14,
    data: {
      provider: 'Halloway Neighbourhood Centre',
      amount: 305000,
      approval_date: '2026-07-26',
      milestone_count: 6,
      contact: 'admin@hallowaycentre.org',
      evidence_url: null,
      cfo_signature: sig('Halloway', 15),
      notes: 'Phase 1 of 6. Large award, quarterly reporting agreed.',
    },
  },
  {
    // Incomplete: in evidence review with no evidence link.
    ref: 'AWD-1047',
    state: 'evidence_review',
    enteredDaysAgo: 10,
    data: {
      provider: 'Kestrel Vocational Institute',
      amount: 47500,
      approval_date: '2026-07-31',
      milestone_count: 2,
      contact: 'bursar@kestrelvi.edu',
      evidence_url: null,
      cfo_signature: null,
      notes: null,
    },
  },
  {
    ref: 'AWD-1048',
    state: 'closed',
    enteredDaysAgo: 22,
    data: {
      provider: 'Marlowe Street Clinic',
      amount: 12900,
      approval_date: '2026-07-15',
      milestone_count: 1,
      contact: 'office@marlowestreet.health',
      evidence_url: 'https://marlowestreet.health/grant/final.pdf',
      cfo_signature: null,
      notes: null,
    },
  },
  {
    // Also appears in Program B once that program is loaded.
    ref: 'AWD-1049',
    state: 'evidence_review',
    enteredDaysAgo: 6,
    data: {
      provider: 'Tanner Ridge Cooperative',
      amount: 76300,
      approval_date: '2026-08-04',
      milestone_count: 3,
      contact: 'coop@tannerridge.org',
      evidence_url: 'https://tannerridge.org/build/milestone-2',
      cfo_signature: sig('Tanner Ridge', 7),
      notes: null,
    },
  },
  {
    ref: 'AWD-1050',
    state: 'tranche_pending',
    enteredDaysAgo: 7,
    data: {
      provider: 'Brightwater Arts Foundation',
      amount: 33000,
      approval_date: '2026-08-01',
      milestone_count: 2,
      contact: 'grants@brightwaterarts.org',
      evidence_url: null,
      cfo_signature: null,
      notes: null,
    },
  },
  {
    ref: 'AWD-1051',
    state: 'approved',
    enteredDaysAgo: 2,
    data: {
      provider: 'Ferndale Mutual Aid',
      amount: 58900,
      approval_date: '2026-08-14',
      milestone_count: 3,
      contact: 'mutualaid@ferndale.org',
      evidence_url: null,
      cfo_signature: sig('Ferndale', 2),
      notes: null,
    },
  },
  {
    ref: 'AWD-1052',
    state: 'tranche_pending',
    enteredDaysAgo: 3,
    data: {
      provider: 'Oakmoor Technical College',
      amount: 210000,
      approval_date: '2026-08-06',
      milestone_count: 5,
      contact: 'finance@oakmoortech.edu',
      evidence_url: null,
      cfo_signature: null,
      notes: null,
    },
  },
]
