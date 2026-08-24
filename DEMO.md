# Grants•OS — demo script

Five to eight minutes. The arc: a queue that tells people what needs them, then a
document arriving and visibly reshaping it, then every rule tracing back to the
sentence that created it.

| | |
|---|---|
| **Where** | https://workflow-agents.vercel.app (or `pnpm dev` on :3000) |
| **Reset** | `pnpm seed` — about five seconds |
| **Starts with** | Milestone Facilities Grant at v2, 12 awards, 8 items in the queue |
| **Live model calls** | Steps 5 and 7 only, ~20s each |

## Before you start

**Re-seed on the morning of the demo.** Grant dates are stored relative to when
the seed ran, so a seed from three days ago makes every item three days more
overdue than this script says.

**Local and production share one database.** Rehearsing locally consumes the same
data you will demo on. Re-seed between runs.

**Check the role.** The header should read *Dana Whitfield, Program Officer*. If a
previous run left it on Finance or CFO, switch it back — the queue counts below
assume the Program Officer's view.

Expected starting queue:

| Role | Overdue | Blocked | Due soon | Total |
|---|---|---|---|---|
| Program Officer | 3 | 3 | 2 | 8 |
| Finance | 3 | — | 2 | 5 |
| CFO | — | 2 | — | 2 |

---

## 1. The queue is the product · ~60s

Open the app.

**Left — To Review:** `3 Overdue · 3 Blocked · 2 Due Soon`. Top card:

> **Riverbend Housing Collective: Disbursement SLO breached**
> $148,000 · 10-day SLO breached, 9 days over. Due 14 Aug. Owned by Finance ·
> Contact Marcus Oyelaran.

**Right — Programs:** Milestone Facilities Grant at v2, with the pipeline funnel —
12 approved → 5 in evidence review → 2 paid — and the five most recently moved
grants listed underneath, with **See all 12**.

> Nobody typed any of this. It is computed from the contract's ten-day clause and
> the date the tranche was released. This is not a dashboard — it is a list of
> things to do, and each one names the person who owes the next move.

---

## 2. Why does it think that? · ~30s

Click **Explain** on the Riverbend card.

The panel quotes §5.4 verbatim — *"Funds shall be released to the provider within
ten (10) days of the tranche being authorised"* — names the document, and says
what would clear the item.

Worth showing while you are here: **Snooze** hides one item for three days without
pausing the clock behind it, so it returns on its own rather than being forgotten.

---

## 3. Same grants, three queues · ~30s

Header person chip → dropdown.

- **Marcus Oyelaran, Finance** — drops to 5. The clock items only; no signature
  requests, because Finance cannot action those.
- **Priya Raman, CFO** — just 2, both signatures.
- Back to **Dana Whitfield, Program Officer** — 8. The coordinator sees all of it,
  with each item naming its owner.

> Same grants, same engine. Three different jobs.

---

## 4. A grant, and provenance · ~60s

Click into **Northgate Community Trust** ($61,400) — the richest grant in the
set. It is blocked awaiting a CFO signature *and* on day 8 of a 10-day clock.

Show the disabled action and the reason underneath it, then click the **§4.2**
chip beside "Dual signature".

> This exists because of this sentence, in this document, introduced in version 2,
> approved by Dana Whitfield, on this date.

---

## 5. The core beat — a document changes the rules · ~90s

Bottom bar → **Create a Version** → **Samples** tab.
Set **Apply to** = *Milestone Facilities Grant (v2)*, then click
`amendment-01.md`.

About twenty seconds of live extraction, with the progress steps showing what the
server is doing.

The review screen shows:

- **Modified · Dual signature** — old and new side by side, **$50,000 → $25,000**,
  with both clauses quoted.
  *Impact: 2 in-flight grants would newly require CFO signature — Kestrel
  Vocational Institute ($47,500), Brightwater Arts Foundation ($33,000).*
- **Modified · Disbursement SLO** — **10 days → 7**, escalation 7 → 5.
  *Impact: 1 in-flight grant would become overdue immediately — Northgate
  Community Trust ($61,400).*
- **Unresolved** — clauses that carry an obligation but no number, recorded rather
  than guessed at.

Two things to say here:

> Nothing has been applied. The model can only emit typed operations — it never
> writes free text that reaches an evaluator. That schema is the whole containment
> story for untrusted documents.

> And it is allowed to say "I don't know". A vague clause becomes an unresolved
> item, not a confident wrong rule that quietly routes real money to the wrong
> person.

Click **Approve and create v3**.

---

## 6. What that did · ~45s

You land on the program page: **now v3**, with *12 grants are still on an older
version* and a **Move all 12 to v3** button.

> Grants stay pinned to the rules that were in force when their work started.
> Moving them is a decision somebody makes, not a side effect of approving a
> document.

Click **Move all 12 to v3**, then go Home.

Northgate has moved from **Due Soon** to **Overdue**. Kestrel and Brightwater are
now **Blocked**. The queue reshaped itself because a document changed.

---

## 7. A second program · ~90s, optional

Header → **Upload a document** → **Samples**.

1. **Apply to** = *— Start a new program —*, click
   `startup-lump-sum-grant/awards.csv`.
   A program appears with 8 grants and a placeholder lifecycle.
2. **Samples** again. **Apply to** = the new program, click its
   `program-contract.md`. Approve.
   It renames itself to **Startup Lump Sum Grant**, and gets a five-day payment
   clock and a completely different lifecycle — single payment, no milestones.

**Tanner Ridge Cooperative** now appears in both programs. Open either grant for
the cross-program callout.

> One queue, two programs with nothing in common structurally, one provider
> drawing from both.

---

## 8. Closing · ~20s

Programs → Milestone Facilities Grant → click any rule's clause chip.

> Every rule in this system traces to a clause in a document that a named person
> approved on a known date. That is what makes it something you could actually run
> a grant program on.

---

## If something goes wrong

- **The model call fails or is slow.** Extraction falls back automatically to
  fixtures committed in the repo. The review header says *"read from a cached
  extraction"*, so the screen stays honest about which path it took.
- **Anything else.** `pnpm seed` resets to the starting state in seconds. It is
  safe to run mid-demo.
- **Wrong role.** Header chip → dropdown. It is a cookie; nothing is lost.

## Known warts, worth getting ahead of

- **Program B ends up with six states** (`draft → approved → disbursed →
  payment_pending → paid → closed`). The spreadsheet's placeholder lifecycle stays
  alongside the contract's real one, because there is no `remove_state` operation
  yet — nothing is silently deleted. To avoid it, load only the contract in step 7
  and skip the spreadsheet, at the cost of the Tanner Ridge moment.
- **Clocks count calendar days, not business days**, even where the contract says
  business days.
- **No auth.** The role switcher is a cookie. For this demo that is the right
  trade: the point is that one set of grants produces three different queues, and
  real auth would only make that harder to show.

## Questions you will get

**"What stops a malicious document from doing something?"**
The delta schema. The model can only emit typed operations against a fixed set of
element types, and the expression language has no arbitrary-expression form. There
is no path from document text to an evaluator, and no operation takes effect
without a person approving it.

**"What if the contract is ambiguous?"**
It comes back as unresolved and is shown on the program page. Step 5 has real
examples in it.

**"Does it generate code?"**
No. It generates a specification, and one fixed engine interprets it. That is what
removes the sandbox, the build pipeline, database branching and migrations from
the problem. Code generation is a v2 line item, not part of this.

**"Can it decide whether the work was actually done?"**
No. It routes and clocks milestone verification. It cannot decide that
construction is finished — a person still does that.
