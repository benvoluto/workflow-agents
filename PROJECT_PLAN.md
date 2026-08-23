# Document-Driven Workflow App — Minimal Implementation Plan

**Goal:** a working demo where uploaded documents produce a running workflow app, changed documents update it, and the app tells people what needs their attention — built with the fewest moving parts that will run on Vercel Pro.

---

## The one decision that removes most of the complexity

**Generate a spec, not code.**

Every layer that would otherwise require code generation gets rendered generically at runtime from the spec: the table, the detail form, the action buttons, the queue. One fixed engine, many program specs.

This eliminates the sandbox, the build-on-change pipeline, database branching, migrations, and fx entirely. The demo experience is identical — the app visibly reshapes itself when a document arrives — but the implementation is a JSON document and an interpreter.

Keep codegen on the roadmap slide. Keep it out of the demo.

---

## Stack

| Piece | Choice | Why |
|---|---|---|
| App | Next.js App Router on Vercel Pro | Single deployment, server actions |
| Database | Neon Postgres | Free tier is plenty; JSONB means no migrations |
| Extraction | Vercel AI SDK, `generateObject` with a Zod schema | One call, structured output, no parser to maintain |
| UI | Tailwind | — |
| Notifications (optional) | Vercel Cron + Resend | Only if the demo needs email; in-app feed is enough |

Five pieces. No auth, no file storage, no PDF parsing, no queue, no sandbox.

---

## Data model — four tables

```sql
document       (id, name, body_text, uploaded_at)
program        (id, name, version, spec jsonb, source_document_id,
                approved_by, created_at)          -- versions are rows, never updates
record         (id, program_id, spec_version, state, data jsonb,
                created_at, updated_at)
event          (id, record_id, type, payload jsonb, actor, at)  -- append-only
```

`event` is the audit trail and the provenance backbone. Nothing is ever mutated in place except `record.state` and `record.data`, and both write an event.

---

## The spec

The single artifact everything hangs off:

```json
{
  "name": "Milestone Facilities Grant",
  "entity": "Award",
  "fields": [
    { "key": "amount", "label": "Award amount", "type": "money", "required": true },
    { "key": "provider", "label": "Provider", "type": "text", "required": true }
  ],
  "states": ["approved", "tranche_pending", "evidence_review", "paid", "closed"],
  "initial": "approved",
  "transitions": [
    { "from": "approved", "to": "tranche_pending", "label": "Release tranche",
      "role": "program_officer",
      "guard": { "gt": ["amount", 0] },
      "source": { "document": "program-contract.md", "clause": "§3.1" } }
  ],
  "rules": [
    { "id": "dual_signature", "when": { "gt": ["amount", 50000] },
      "require": ["cfo_signature"],
      "source": { "document": "program-contract.md", "clause": "§4.2" } }
  ],
  "clocks": [
    { "id": "disbursement_slo", "from_state": "tranche_pending",
      "days": 10, "warn_at": 7, "owner_role": "finance",
      "source": { "document": "program-contract.md", "clause": "§5.4" } }
  ]
}
```

**Every element carries a `source`.** That is what makes the provenance panel possible, and it costs nothing to require it at extraction time.

**Expression DSL:** a JSON-logic subset — `eq, gt, gte, lt, lte, and, or, not` — where operands are field keys or literals. Roughly 40 lines of evaluator. Resist every temptation to allow arbitrary expressions; that boundary is the whole safety story.

---

## Four modules

### 1. Ingest → spec delta
Server action: document text + current spec → `generateObject` → a list of operations (`add_field`, `add_rule`, `modify_rule`, `add_clock`, `modify_transition`), each with a clause citation and a plain-English summary.

The model never returns a whole spec. Only deltas. This is what makes review tractable and conflicts visible.

### 2. Review & apply
Render the delta as a readable diff. If an operation modifies an existing element by `id`, show old vs. new side by side with both source clauses — that is the conflict UI, and matching on `id` is all the detection it needs.

On approve: write a new `program` row at `version + 1`. Existing records keep their `spec_version` unless explicitly migrated.

### 3. Runtime engine
Pure functions over spec + record:

- `availableTransitions(spec, record, role)` — filters by `from` state, guard, and role
- `applyTransition(...)` — validates, writes state, appends event
- `renderFields(spec, record)` — generic form from field definitions

The entire UI is a table view, a detail view, and a button row, all driven by the spec. Roughly 300 lines of React total.

### 4. Attention engine
The differentiator, and it is one pure function:

```
attention(spec, records, now) → Item[]
```

Four item sources:

1. **Clock breach or approach** — from `spec.clocks`
2. **Blocked** — the only forward transition requires an approval nobody has given
3. **Incomplete** — a required field is empty and the record is trying to move
4. **Change impact** — records on an older `spec_version` that a new rule would affect

Recomputed on page load. At demo scale that is free, and it means no cron, no job queue, no background workers.

---

## Interface — four screens

1. **Inbox** (landing). The attention feed, grouped by urgency, each item naming the person, the record, the deadline, and the reason. Not a dashboard — a list of things to do.
2. **Records.** Generic table, filterable by program and state.
3. **Record detail.** Fields, state, available actions, and full event history.
4. **Program.** The spec rendered readably. Every rule clickable → **provenance panel**: the clause, the document, the version, the approver.

Plus a **role switcher** in the header (Program Officer / Finance / CFO). No auth needed, and it is better for demoing — the same queue seen from three perspectives makes the routing story land instantly.

---

## Sample documents

Ship them in the repo as `/samples`, with a one-click "Load sample" button. Accept `.md`, `.txt`, `.csv`, and pasted text. **Do not build PDF parsing for the demo.**

Two programs, three documents each:

**Program A — Milestone Facilities Grant**
- `awards.csv` — 12 rows: provider, amount, approval date, milestone count
- `program-contract.md` — tranche schedule, evidence required per milestone, 10-day disbursement SLO, dual signature above $50k
- `amendment-01.md` — dual signature threshold drops to $25k, SLO tightens to 7 days

**Program B — Startup Lump Sum Grant**
- `awards.csv` — 8 rows
- `program-contract.md` — single payment on approval, no milestones, 5-day SLO

Plant two things deliberately: one in-flight $61k award that the amendment retroactively affects, and one provider appearing in both programs.

---

## Build order

| Phase | Deliverable | Demoable? |
|---|---|---|
| 1 | Schema, spec type, expression evaluator, hand-written seed spec | No |
| 2 | Generic table + detail + transitions from spec | Yes — "a working app" |
| 3 | CSV import → records | Yes — "from your spreadsheet" |
| 4 | Document → delta → review → apply | Yes — **the core beat** |
| 5 | Attention engine + inbox + role switcher | Yes — "it tells you" |
| 6 | Provenance panel, second program, cross-program view | Yes — full demo |

Each phase ends demoable. If time runs out, stop at 5 and demo one program.

---

## Explicitly out of scope

No code generation. No sandbox or fx. No database branching. No migrations. No auth. No file storage or PDF parsing. No multi-tenancy. No email. No cross-program conflict detection beyond a shared-provider flag.

Every one of these is a legitimate v2 line item and a good answer to "what's next." None belongs in the first working version.

---

## Demo script — five minutes

1. Upload `awards.csv`. A working app appears: real records, a default lifecycle.
2. Upload `program-contract.md`. Diff appears — new states, a dual-signature rule, a 10-day clock, each citing its clause. Approve.
3. **Inbox lights up.** Three payments past the SLO, one award blocked awaiting a second signature. Switch role to Finance — different queue, same records.
4. Upload `amendment-01.md`. Conflict surfaces: threshold $50k → $25k, with both clauses shown. Approve, and the system names the in-flight awards now affected.
5. Upload Program B's contract. A second program appears with a completely different lifecycle. One shared queue, mixed items, one provider drawing from both.
6. Click any rule → provenance panel. *This exists because of this sentence, in this document, approved by this person, on this date.*

---

## Honest limits

- **Prompt injection.** Uploaded documents are untrusted input to the extractor. The delta schema is the containment boundary — the model can only emit typed operations, never free text reaching a tool call. Say this before someone asks.
- **Ambiguity.** Real contracts are vague. The extractor needs an "unresolved" outcome rather than a confident guess. Showing one of these in the demo is a strength.
- **Judgment.** The system routes and clocks milestone verification. It cannot decide that construction is actually finished.