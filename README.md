# Grants•OS

Upload the documents that govern a process, and get a running app: real grants,
a real lifecycle, and a queue that tells people what needs them. Change the
documents and the app changes with them — with every rule tracing back to the
clause it came from.

## The idea

The system generates a **specification, not code**. One fixed engine interprets
many program specs, which is what removes the sandbox, the build-on-change
pipeline, database branching, and migrations from the problem entirely.

A document is never applied directly. It is read into a list of **typed
operations** — `add_rule`, `modify_clock`, `add_field`, `unresolved` — each
carrying a clause citation and a plain-English summary. A person reviews them and
approves. Only then does a new version exist.

## Running it

Two things are needed: a Postgres database and an Anthropic API key. Everything
else has a working default.

### Setting it up on Vercel

```bash
pnpm install
vercel link                                              # create or link the project
vercel integration add neon                              # Postgres — sets DATABASE_URL
vercel blob create-store documents --access private      # optional, see below
vercel env add ANTHROPIC_API_KEY                         # prompts for the key
vercel env pull .env.local                               # bring the whole set down
pnpm db:migrate                                          # create the schema
pnpm seed                                                # Program A pre-seeded at v2
vercel deploy --prod
```

`db:migrate` and `seed` run from your machine against whatever `DATABASE_URL`
points at, so run them once after the database exists and before the first
visit. `seed` truncates every table — it is a reset, not an increment.

The Blob store archives the original bytes of every uploaded document. It has to
be private, because the app reads documents back server-side rather than by
public URL. Skip it and uploads still extract and version correctly; there is
just no original to link back to.

### Running it locally

If the project is already linked, `vercel env pull .env.local` is the whole
setup. Otherwise copy [`.env.example`](.env.example) to `.env.local` and fill in
`DATABASE_URL` and `ANTHROPIC_API_KEY` by hand — a Neon connection string and a
key from [the Anthropic console](https://console.anthropic.com/settings/keys)
are enough.

```bash
pnpm install
pnpm db:migrate
pnpm seed
pnpm dev
```

The database driver is Neon's serverless HTTP client, so `DATABASE_URL` has to
point at a Neon database (or a Neon-compatible proxy) rather than a plain local
Postgres.

### Model access

Extraction runs on Claude Opus 5. Two routes, resolved in `lib/ingest/model.ts`:

- **`ANTHROPIC_API_KEY` set** — calls the Anthropic API directly. This is the
  route in use, and the one the setup above configures.
- **Otherwise** — routes through Vercel AI Gateway using OIDC, so no provider key
  is needed. This needs paid AI Gateway credits on the team; Anthropic models are
  not available on the Gateway's free tier.

Override the model with `EXTRACTION_MODEL`.

With neither route working, uploads fall back to extraction results committed for
the documents in `/samples`, so the demo still runs — but a document of your own
will not extract.

## The demo

Step-by-step script, including timings, fallbacks and the questions it tends to
provoke: **[DEMO.md](DEMO.md)**.

Program A is seeded at v2 with twelve awards in flight, so the queue has
something to say on first load. Steps 4 and 5 run live against the real
extractor.

1. **To Review.** Three payments past their service level objective for time, two 
   approaching, two awaiting a CFO signature, one missing its evidence link. 
   Switch role in the header — the same grants, three different queues.
2. **Any grant.** Fields, available actions with the reasons they are blocked,
   and full history.
3. **Program.** The spec rendered readably. Click any clause chip for the
   provenance panel: the sentence, the document, the version, the approver.
4. **Upload `amendment-01.md`.** The dual-signature threshold drops from $50,000
   to $25,000 and the disbursement clock tightens from 10 days to 7. Both appear
   as *modified* operations with the old and new clause side by side, and each
   names the in-flight awards it would affect. Approve to create v3.
5. **Upload Program B's contract.** A second program with a completely different
   lifecycle, one shared queue, and Tanner Ridge Cooperative drawing from both.

Sample documents are in `/samples` and load from the Samples tab of the upload
dialog.

## Layout

| Path | What lives there |
|---|---|
| `lib/spec/` | The spec model, the expression DSL and its evaluator, delta operations |
| `lib/engine/runtime.ts` | `availableTransitions`, `validateTransition`, field requirements |
| `lib/engine/attention.ts` | `attention(programs, records, now)` — the whole queue, one pure function |
| `lib/engine/wake.ts` | `nextWakeAt` — when a record next changes on its own |
| `lib/engine/materialize.ts` | Recompute on write, the midnight sweep, and `verifyQueue` |
| `app/api/cron/` | The scheduled endpoints: sweep, wake, verify |
| `lib/ingest/` | Extraction prompts, the model route, the fixture fallback |
| `lib/db/schema.ts` | Ten tables: documents, programs, program_versions, records, events, deltas, snoozes, and the derived attention_items, record_wakeups, queue_runs |
| `app/actions.ts` | Every write the app can perform |
| `samples/` | The sample documents |
| `components/` | The interface: split queue cards, program cards, the funnel, the explain and provenance panels |
| `design/figma-sample-data.md` | Copy and data for designing the screens |
| `design/programofficerview.png` | The design this interface follows |
| `DEMO.md` | The demo script |

Versions are rows, never updates. Grants pin to the version they are being run
under, and moving one forward is an explicit decision with an event to show for
it.

## Interface

The home screen is two columns: the queue on the left, the programs on the
right, with a question box and quick actions along the bottom. Icons are
Phosphor and the type is SF Pro, per `design/programofficerview.png`.

A queue card is one rounded container split down the middle — the tinted left
carries the urgency and names the problem, the white right says what to do about
it. **Explain** opens the clause the item traces to, quoted from the document
that put it there. **Snooze** hides one item for three days without pausing the
clock behind it, so it returns on its own.

The Program Officer sees the whole queue with each item naming its owner;
Finance and the CFO see only what is theirs. Switch in the header.

The interface calls them **grants** and lists them at `/grants`. Internally they
are `records` — the engine is generic and knows nothing about grant-making, and
keeping the domain word out of it is what lets one spec interpreter run programs
of any shape.

## Scripts

| Command | Does |
|---|---|
| `pnpm seed` | Reset to the demo's starting state — twelve hand-placed awards |
| `pnpm seed:scale` | Reset to two programs at ~1,100 awards each (`pnpm seed:scale 5000` for more) |
| `pnpm fixtures` | Run the real extractors over `/samples` and commit the results as a fallback cache |
| `pnpm samples` | Re-embed `/samples` after editing them |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle migrations |

## The queue

The queue is one pure function — `attention(programs, records, now)` — over the
specs, the records, and what time it is. That has not changed. What changed is
that the answer is now kept in a table instead of being recomputed on every page
load, and the function's job is to define what belongs in that table and to
prove, on a schedule, that it still does.

### Why the recompute moved

Not for speed. Evaluating a few dozen rules against a couple of thousand records
is milliseconds; what hurt was fetching every row with its `jsonb` payload on
every request. The real gap was different: computed only on page load, nothing
could happen **between** page loads. A payment passed its service level
objective at 2am and the system's reaction was to wait for somebody to open a
browser.

### It only changes at midnight

`now` reaches the engine through exactly one function, `daysBetween`, which
floors both instants to UTC midnight. Every urgency test, every sort key and
every label is a day count; `dueAt` derives from `stateEnteredAt`, not from
`now`.

So for a fixed set of records and specs, **the queue is a step function that can
only change at UTC midnight**. Which means there is nothing to poll for. Two
triggers cover every way the answer can move:

| Trigger | What it recomputes |
|---|---|
| a write — transition, field edit, approval, migration, import | that record, plus its program's change-impact rows |
| `0 0 * * *` — the day boundary | every program, because day-count labels all move at once |

`nextWakeAt(record, specs, now)` derives the instant a record will turn over
from `stateEnteredAt` and the clock, and stores it in `record_wakeups`. So
`/api/cron/wake` scans an index on one timestamp rather than every grant in
flight, and is a no-op on most runs. It exists as the hook for the thing a
page-load queue cannot do at all: notifying the person who owns an item the
moment it breaches.

### The cache cannot quietly drift

Materialising a queue normally costs you the property that made it trustworthy —
that there is exactly one definition of what needs attention. It does not cost
that here, because the pure function is still the arbiter and something asks it:
`verifyQueue` runs the engine again and diffs it against the table, reporting
anything missing, extra or changed. It runs at the end of every sweep, at the
end of both seed scripts, and on demand at `/api/cron/verify`, which answers 409
when the two disagree. A non-empty diff is a bug report, not a reconciliation
step — nothing in it writes.

Three things keep this honest in the design rather than by discipline:

- **`attention_items` stores the whole item as `jsonb`**, not spread across
  columns, so the engine stays the single definition of what an item is. The
  columns beside it are only what the read path filters and sorts on.
- **Sharding is provable, not hopeful.** The record loop never reads across
  programs and change impact is already scoped to one, so
  `attention(all, all, now)` is `attentionForProgram` mapped and sorted.
  Recomputing one program in isolation cannot give a different answer.
- **Per-viewer filters stay in the read path.** Role and snooze are cheap
  predicates over cached rows — one cache, three role views — so neither is ever
  a reason to recompute.

### Reading it

Nothing on the home screen loads the full set of grants any more. The tabs are a
`group by`, the funnel is a `group by`, the queue is a page of 50, and
`/grants` pages in SQL with "needs attention" as an `EXISTS` against the cache.
The exception is deliberate: the review screen loads one program's records in
full, because a count of what an amendment would affect is worse than useless if
it is only approximately right.

### Running it at scale

```bash
pnpm db:migrate
pnpm seed:scale          # two programs, ~1,100 awards each, 2,212 records
```

The script seeds both programs, builds the queue, and verifies it. On a Neon
database that is roughly:

```
Records:       2,212
Events:        6,795
Queue items:   612 in 4200ms
Verification:  cache matches the engine
```

`CRON_SECRET` guards the three endpoints when it is set, and Vercel Cron sends
it automatically. `vercel.json` schedules the sweep only; `/api/cron/wake` is
left unscheduled because the Hobby plan allows one cron a day, and every wakeup
lands at midnight anyway — schedule it more often on a paid plan if you want the
escalation hook to fire promptly.

## Known limits

- **Prompt injection.** Uploaded documents are untrusted input. The delta schema
  is the containment boundary: the model can only emit typed operations, and the
  expression DSL has no arbitrary-expression form, so nothing it writes reaches
  an evaluator as free text.
- **Ambiguity.** Vague clauses come back as `unresolved` rather than as a
  confident guess, and are shown on the program page rather than silently
  dropped.
- **Judgment.** The system routes and clocks milestone verification. It cannot
  decide that construction is actually finished.
- Clocks count calendar days, not business days, even where a contract says
  otherwise. This is also what makes the midnight-only recompute correct, so
  business days would mean rethinking the wakeup schedule, not just the label.
- **Recompute-on-write costs about a second.** It is roughly ten sequential
  round trips to Neon over HTTP inside the server action. Correct, and invisible
  next to the redirect, but a real deployment would batch it or move it behind a
  queue rather than making the person who clicked wait for it.
- **The verification job reports; it does not repair.** A mismatch is left
  standing on the assumption that a wrong cache is a bug worth seeing rather
  than papering over. The next sweep overwrites it either way.
- A same-millisecond double write to one record can leave a stale row until the
  next sweep, because stale rows are identified by timestamp rather than by a
  run id.
- Change-impact rows name the first six affected grants and then count the rest;
  at a thousand records the full list was a paragraph nobody reads.
- No auth. The role switcher is a cookie, which is the right trade for a demo
  whose point is that one set of grants produces three different queues.
- No PDF parsing, no cross-program conflict detection beyond a shared-party flag,
  and no code generation.
