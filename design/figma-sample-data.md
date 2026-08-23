# Figma Sample Data — Document-Driven Workflow App

Realistic, internally consistent copy for designing the four main screens: **Inbox**, **Records**, **Record detail**, **Program / provenance**, plus the **Review diff** modal.

Everything below is mutually consistent — the same records, amounts, dates, and people recur across screens. **"Today" is Sunday 23 August 2026.** All relative labels ("4 days over") are computed from that date, so if you change today, re-derive them.

---

## 0. Global chrome

**Product name:** Workflow Agents
**Header nav:** Inbox · Records · Programs
**Role switcher (header, right):** a segmented control or dropdown, three options, one active at a time.

| Role | Display name | Initials | Person shown as |
|---|---|---|---|
| `program_officer` | Program Officer | PO | Dana Whitfield |
| `finance` | Finance | FI | Marcus Oyelaran |
| `cfo` | CFO | CF | Priya Raman |

Inbox badge counts per role (design the badge with a 2-digit max):

| Role | Inbox count |
|---|---|
| Program Officer | 6 |
| Finance | 5 |
| CFO | 2 |

**Upload affordance (header or Inbox empty state):** `Upload a document` · secondary: `Load sample`
Accepted-types helper text: `.md, .txt, .csv, or paste text`

---

## 1. Programs

| # | Program name | Entity | Version | Records | Lifecycle |
|---|---|---|---|---|---|
| A | Milestone Facilities Grant | Award | v2 (v3 pending) | 12 | approved → tranche_pending → evidence_review → paid → closed |
| B | Startup Lump Sum Grant | Award | v1 | 8 | approved → payment_pending → paid → closed |

State chip labels (design 5 chip variants; suggested tone in brackets):

| State key | Chip label | Tone |
|---|---|---|
| `approved` | Approved | neutral |
| `tranche_pending` | Tranche pending | in-progress |
| `evidence_review` | Evidence review | in-progress |
| `payment_pending` | Payment pending | in-progress |
| `paid` | Paid | success |
| `closed` | Closed | muted |

---

## 2. Inbox — the attention feed

Landing screen. Grouped by urgency, not a dashboard. Each item names **who**, **what record**, **the deadline**, and **the reason**.

Group headers and counts (Program Officer view):

- `Overdue` — 4
- `Due soon` — 3
- `Blocked` — 2
- `Affected by a pending change` — 2

### 2.1 Overdue

| Reason chip | Headline | Sub-line | Owner | Amount | Age label |
|---|---|---|---|---|---|
| Clock breach | Riverbend Housing Collective — tranche not disbursed | Disbursement SLO of 10 days breached · due 14 Aug | Finance · Marcus Oyelaran | $148,000 | **9 days over** |
| Clock breach | Halloway Neighbourhood Centre — tranche not disbursed | Disbursement SLO of 10 days breached · due 19 Aug | Finance · Marcus Oyelaran | $305,000 | **4 days over** |
| Clock breach | Ashfield Works — tranche not disbursed | Disbursement SLO of 10 days breached · due 22 Aug | Finance · Marcus Oyelaran | $92,000 | **1 day over** |
| Clock breach | Vellum Labs — payment not issued | Payment SLO of 5 days breached · due 19 Aug | Finance · Marcus Oyelaran | $25,000 | **4 days over** |

### 2.2 Due soon

| Reason chip | Headline | Sub-line | Owner | Amount | Age label |
|---|---|---|---|---|---|
| Clock warning | Northgate Community Trust — tranche not disbursed | Day 8 of 10 · due 25 Aug | Finance · Marcus Oyelaran | $61,400 | **2 days left** |
| Clock warning | Brightwater Arts Foundation — tranche not disbursed | Day 7 of 10 · due 26 Aug | Finance · Marcus Oyelaran | $33,000 | **3 days left** |
| Clock warning | Tanner Ridge Cooperative — payment not issued | Day 5 of 5 · due today | Finance · Marcus Oyelaran | $25,000 | **due today** |

### 2.3 Blocked

| Reason chip | Headline | Sub-line | Owner | Amount | Age label |
|---|---|---|---|---|---|
| Awaiting signature | Northgate Community Trust — needs a second signature | Award above $50,000 requires CFO sign-off · §4.2 | CFO · Priya Raman | $61,400 | waiting 8 days |
| Awaiting signature | Oakmoor Technical College — needs a second signature | Award above $50,000 requires CFO sign-off · §4.2 | CFO · Priya Raman | $210,000 | waiting 3 days |

### 2.4 Incomplete (folds into Blocked, or its own group — design both)

| Reason chip | Headline | Sub-line | Owner | Amount |
|---|---|---|---|---|
| Missing information | Kestrel Vocational Institute — evidence link is empty | Cannot leave Evidence review until *Evidence URL* is filled | Program Officer · Dana Whitfield | $47,500 |

### 2.5 Affected by a pending change

| Reason chip | Headline | Sub-line | Owner |
|---|---|---|---|
| Change impact | 2 in-flight awards would newly require a second signature | Amendment 01 lowers the threshold to $25,000 · §4.2 | Program Officer · Dana Whitfield |
| Change impact | 5 in-flight awards would be immediately overdue | Amendment 01 tightens the disbursement SLO to 7 days · §5.4 | Finance · Marcus Oyelaran |

### 2.6 Finance-role view (same records, different queue)

Design this as the *identical layout with different rows* — it is the whole point of the role switcher.

- Overdue (4): Riverbend, Halloway, Ashfield, Vellum Labs
- Due soon (3): Northgate, Brightwater, Tanner Ridge
- Blocked (0) — Finance sees no signature items
- Empty-group copy: `Nothing blocked for Finance.`

### 2.7 CFO view (2 items only — design the sparse state)

- Blocked (2): Northgate Community Trust · $61,400 · `Sign` — Oakmoor Technical College · $210,000 · `Sign`
- Everything-else copy: `Nothing else needs the CFO right now.`

### 2.8 Inbox empty state

Heading: `Nothing needs your attention`
Body: `When a clock runs down, an approval stalls, or a document changes the rules, it shows up here.`
Action: `Upload a document`

---

## 3. Records table

Columns: **Provider · Program · Amount · State · Owner · Age in state · Flags**

### Program A — Milestone Facilities Grant (12 records)

| ID | Provider | Amount | State | Entered state | Age | Owner | Flags |
|---|---|---|---|---|---|---|---|
| AWD-1041 | Northgate Community Trust | $61,400 | Tranche pending | 15 Aug 2026 | 8d | Finance | Blocked · Clock warning |
| AWD-1042 | Riverbend Housing Collective | $148,000 | Tranche pending | 4 Aug 2026 | 19d | Finance | Overdue |
| AWD-1043 | Cedar Hollow Youth Services | $24,750 | Evidence review | 11 Aug 2026 | 12d | Program Officer | — |
| AWD-1044 | Ashfield Works | $92,000 | Tranche pending | 12 Aug 2026 | 11d | Finance | Overdue |
| AWD-1045 | Portside Learning Alliance | $18,200 | Paid | 6 Aug 2026 | 17d | — | — |
| AWD-1046 | Halloway Neighbourhood Centre | $305,000 | Tranche pending | 9 Aug 2026 | 14d | Finance | Overdue |
| AWD-1047 | Kestrel Vocational Institute | $47,500 | Evidence review | 13 Aug 2026 | 10d | Program Officer | Missing information |
| AWD-1048 | Marlowe Street Clinic | $12,900 | Closed | 1 Aug 2026 | 22d | — | — |
| AWD-1049 | Tanner Ridge Cooperative | $76,300 | Evidence review | 17 Aug 2026 | 6d | Program Officer | Also in Program B |
| AWD-1050 | Brightwater Arts Foundation | $33,000 | Tranche pending | 16 Aug 2026 | 7d | Finance | Clock warning |
| AWD-1051 | Ferndale Mutual Aid | $58,900 | Approved | 21 Aug 2026 | 2d | Program Officer | — |
| AWD-1052 | Oakmoor Technical College | $210,000 | Tranche pending | 20 Aug 2026 | 3d | Finance | Blocked |

### Program B — Startup Lump Sum Grant (8 records)

| ID | Provider | Amount | State | Entered state | Age | Owner | Flags |
|---|---|---|---|---|---|---|---|
| AWD-2007 | Tanner Ridge Cooperative | $25,000 | Payment pending | 18 Aug 2026 | 5d | Finance | Due today · Also in Program A |
| AWD-2008 | Vellum Labs | $25,000 | Payment pending | 14 Aug 2026 | 9d | Finance | Overdue |
| AWD-2009 | Quayside Robotics | $15,000 | Payment pending | 20 Aug 2026 | 3d | Finance | — |
| AWD-2010 | Sable & Finch Bakery | $10,000 | Paid | 12 Aug 2026 | 11d | — | — |
| AWD-2011 | Northwind Analytics | $25,000 | Approved | 22 Aug 2026 | 1d | Program Officer | — |
| AWD-2012 | Puget Fibre Co-op | $20,000 | Paid | 8 Aug 2026 | 15d | — | — |
| AWD-2013 | Merrow Bio | $15,000 | Closed | 30 Jul 2026 | 24d | — | — |
| AWD-2014 | Lockridge Tooling | $10,000 | Approved | 23 Aug 2026 | today | Program Officer | New |

**Filter chips above the table:** `All programs` · `Milestone Facilities Grant` · `Startup Lump Sum Grant` · `Any state` · `Needs attention (9)`

**Longest strings to test truncation:** `Halloway Neighbourhood Centre` (29 ch) · `Milestone Facilities Grant` (26 ch) · `$305,000` · `Tranche pending`

---

## 4. Record detail — hero record

Use **AWD-1041 · Northgate Community Trust** as the design hero: it is simultaneously blocked, clock-warned, and about to be hit by the pending amendment. Every panel has something in it.

**Header**
- Title: `Northgate Community Trust`
- Sub: `AWD-1041 · Milestone Facilities Grant · spec v2`
- State chip: `Tranche pending`
- Banner (warning): `Blocked — awaiting CFO signature for 8 days. Disbursement due 25 Aug (2 days left).`

**Fields panel** (generic form rendered from the spec)

| Label | Type | Value | Required |
|---|---|---|---|
| Award amount | money | $61,400 | yes |
| Provider | text | Northgate Community Trust | yes |
| Approval date | date | 2 Aug 2026 | yes |
| Milestone count | number | 3 | yes |
| Evidence URL | url | *(empty)* | yes at Evidence review |
| CFO signature | signature | *(not signed)* | conditional — §4.2 |
| Notes | textarea | Site handover slipped a week; provider confirmed revised schedule by email. | no |

**Action row** (what the current role can do — design all three states)

| Role | Buttons |
|---|---|
| Program Officer | `Request evidence` (primary, disabled) · `Return to Approved` (secondary) — helper: *Blocked until the CFO signs.* |
| Finance | `Mark disbursed` (primary, disabled) — helper: *Blocked until the CFO signs.* |
| CFO | `Sign off` (primary) · `Decline` (secondary) |

**Event history** (newest first; each row = actor · action · timestamp)

| When | Actor | Event |
|---|---|---|
| 18 Aug 2026, 09:14 | System | Signature requested from CFO — rule `dual_signature` (§4.2) |
| 15 Aug 2026, 16:02 | Dana Whitfield (Program Officer) | Released tranche — Approved → Tranche pending (§3.1) |
| 15 Aug 2026, 16:02 | System | Clock started — Disbursement SLO, 10 days (§5.4) |
| 10 Aug 2026, 11:30 | Dana Whitfield (Program Officer) | Applied spec v2 from `program-contract.md` |
| 4 Aug 2026, 08:45 | System | Record created from `awards.csv`, row 1 |

**Provenance chip** appears inline on any field or action that traces to a clause: small link-style chip reading `§4.2` that opens the provenance panel.

**A second, quieter record for contrast — AWD-1045 · Portside Learning Alliance:** state `Paid`, no banner, no flags, 3 events, all actions greyed except `Close`. Design the calm version too.

---

## 5. Program screen + provenance panel

**Program A spec, rendered readably.** Sections: Fields · States · Transitions · Rules · Clocks. Each row is clickable.

**Transitions**

| From | To | Label | Role | Guard | Source |
|---|---|---|---|---|---|
| Approved | Tranche pending | Release tranche | Program Officer | Award amount > 0 | program-contract.md §3.1 |
| Tranche pending | Evidence review | Mark disbursed | Finance | — | program-contract.md §3.4 |
| Evidence review | Paid | Accept evidence | Program Officer | Evidence URL is set | program-contract.md §3.6 |
| Paid | Closed | Close award | Program Officer | — | program-contract.md §6.1 |

**Rules**

| ID | When | Requires | Source |
|---|---|---|---|
| `dual_signature` | Award amount > $50,000 | CFO signature | program-contract.md §4.2 |
| `evidence_per_milestone` | Milestone count > 0 | Evidence URL | program-contract.md §4.5 |

**Clocks**

| ID | Starts on | Days | Warn at | Owner | Source |
|---|---|---|---|---|---|
| `disbursement_slo` | Tranche pending | 10 | 7 | Finance | program-contract.md §5.4 |

### Provenance panel (slide-over) — clicking rule `dual_signature`

- Panel title: `Dual signature`
- Section `The rule`: `When Award amount is greater than $50,000, a CFO signature is required before the tranche can be disbursed.`
- Section `Where it came from`:
  - Document: `program-contract.md`
  - Clause: `§4.2 Authorisation thresholds`
  - Quoted text (design a blockquote): *"Any disbursement in excess of fifty thousand dollars ($50,000) shall require the counter-signature of the Chief Financial Officer, recorded prior to release of funds."*
- Section `How it got here`:
  - Extracted 10 Aug 2026, 11:22
  - Approved by **Dana Whitfield** (Program Officer), 10 Aug 2026, 11:30
  - Introduced in **spec v2**
- Footer link: `View the source document`
- Pending-change notice (this rule specifically): `Amendment 01 proposes changing this threshold to $25,000. Review pending.`

**Second provenance example — clock `disbursement_slo`, §5.4:** *"Funds shall be released to the provider within ten (10) business days of the milestone being certified."*

---

## 6. Review diff — the core beat

Triggered by uploading `amendment-01.md` against Program A v2. Design as a full-screen review or a wide modal.

**Header:** `Amendment 01 · 3 proposed changes` · sub: `From amendment-01.md, uploaded just now`
**Actions:** `Approve all and create v3` (primary) · `Approve selected` · `Discard`

### Change 1 — modified rule (this is the conflict UI)

- Op chip: `Modified` · target: rule `dual_signature`
- Plain-English summary: `The second-signature threshold drops from $50,000 to $25,000.`
- Side-by-side:

| | Current (v2) | Proposed (v3) |
|---|---|---|
| When | Award amount > $50,000 | Award amount > **$25,000** |
| Requires | CFO signature | CFO signature |
| Source | program-contract.md §4.2 | amendment-01.md §2.1 |
| Clause text | *"…in excess of fifty thousand dollars ($50,000)…"* | *"…Clause 4.2 is amended such that the threshold shall read twenty-five thousand dollars ($25,000)…"* |

- Impact line: `2 in-flight awards would newly require a signature: Kestrel Vocational Institute ($47,500), Brightwater Arts Foundation ($33,000).`

### Change 2 — modified clock

- Op chip: `Modified` · target: clock `disbursement_slo`
- Summary: `The disbursement window tightens from 10 days to 7 days.`

| | Current (v2) | Proposed (v3) |
|---|---|---|
| Days | 10 | **7** |
| Warn at | 7 | **5** |
| Source | program-contract.md §5.4 | amendment-01.md §3.1 |

- Impact line (design this in a warning tone): `5 in-flight awards would become overdue immediately, including Northgate Community Trust ($61,400), currently at day 8.`

### Change 3 — added field

- Op chip: `Added` · target: field `amendment_ack`
- Summary: `Providers must acknowledge the amendment before the next tranche.`
- Detail: `Label: Amendment acknowledged · Type: checkbox · Required: yes, from Tranche pending onward · Source: amendment-01.md §5.2`

### Change 4 — unresolved (design this state; it is a strength, not an error)

- Op chip: `Unresolved` (neutral/amber, not red)
- Summary: `The document says evidence must be submitted "promptly" but gives no number of days.`
- Quoted: *"Evidence of completion shall be submitted promptly upon certification."* — amendment-01.md §4.4
- Actions: `Set a value` · `Ignore this clause`

### Ingest progress states (for the upload → diff transition)

1. `Reading amendment-01.md…`
2. `Comparing against Milestone Facilities Grant v2…`
3. `3 changes and 1 unresolved clause found`

---

## 7. Post-approval confirmation

Toast / banner after approving v3:

> **Milestone Facilities Grant is now v3.** 7 in-flight awards are affected. [Review them]

And a `Change impact` section on the Inbox listing the affected records:

| Record | Amount | Why it changed |
|---|---|---|
| AWD-1041 Northgate Community Trust | $61,400 | Now 1 day overdue under the 7-day SLO |
| AWD-1050 Brightwater Arts Foundation | $33,000 | Now needs a CFO signature |
| AWD-1047 Kestrel Vocational Institute | $47,500 | Now needs a CFO signature |
| AWD-1042 Riverbend Housing Collective | $148,000 | Overdue window grows to 12 days |
| AWD-1044 Ashfield Works | $92,000 | Now 4 days overdue |
| AWD-1046 Halloway Neighbourhood Centre | $305,000 | Now 7 days overdue |
| AWD-1052 Oakmoor Technical College | $210,000 | Still within window · 3 of 7 days |

---

## 8. Cross-program view (shared provider)

Callout on either Tanner Ridge record:

> **Tanner Ridge Cooperative appears in two programs.** $76,300 in Milestone Facilities Grant (Evidence review) and $25,000 in Startup Lump Sum Grant (Payment pending, due today). Combined exposure $101,300.

---

## 9. Copy deck — short strings

**Empty states**
- No records yet: `No records yet. Upload a spreadsheet to get started.`
- No programs: `No programs yet. Upload a contract or load a sample.`
- Filtered to nothing: `No records match these filters.`
- No events: `Nothing has happened to this record yet.`

**Buttons:** Upload a document · Load sample · Approve · Approve all and create v3 · Discard · Sign off · Decline · Release tranche · Mark disbursed · Accept evidence · Close award · Request evidence · View the source document · Set a value

**Reason chips:** Clock breach · Clock warning · Awaiting signature · Missing information · Change impact · Unresolved

**Flags:** Overdue · Due today · Blocked · Missing information · Also in Program B · New

**Time labels:** due today · 2 days left · 1 day over · 4 days over · 9 days over · waiting 8 days · 8d · today

**Numbers to typeset:** `$10,000` `$24,750` `$61,400` `$148,000` `$305,000` `$101,300` — design the money style for 5- and 6-figure widths.

---

## 10. Screen inventory for the Figma file

| Frame | Screen | Notes |
|---|---|---|
| 1 | Inbox — Program Officer | 4 groups, 11 items, badge 6 |
| 2 | Inbox — Finance | same layout, different rows, one empty group |
| 3 | Inbox — CFO | sparse state, 2 items |
| 4 | Inbox — empty | first-run |
| 5 | Records — all programs | 20 rows, filter chips |
| 6 | Record detail — AWD-1041 | hero: banner, blocked actions, 5 events |
| 7 | Record detail — AWD-1045 | calm: paid, no flags |
| 8 | Program — spec rendered | fields, transitions, rules, clocks |
| 9 | Provenance panel | slide-over over frame 8 |
| 10 | Upload → ingest progress | 3 progress states |
| 11 | Review diff | 3 changes + 1 unresolved |
| 12 | Post-approval toast + change impact | frame 1 with the new section |
