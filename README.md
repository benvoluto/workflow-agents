# Workflow Agents

Upload the documents that govern a process, and get a running app: real records,
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

```bash
pnpm install
vercel link                 # links to the Vercel project
vercel env pull .env.local  # DATABASE_URL, BLOB_READ_WRITE_TOKEN, model access
pnpm db:migrate             # create the schema
pnpm seed                   # Program A pre-seeded at v2
pnpm dev
```

### Model access

Extraction runs on Claude Opus 5. Two routes, resolved in `lib/ingest/model.ts`:

- **`ANTHROPIC_API_KEY` set** — calls the Anthropic API directly. This is the
  route in use.
- **Otherwise** — routes through Vercel AI Gateway using OIDC, so no provider key
  is needed. This needs paid AI Gateway credits on the team; Anthropic models are
  not available on the Gateway's free tier.

Override the model with `EXTRACTION_MODEL`.

### The wire format is not the domain model

Structured output will not compile a schema that is self-referencing, uses
positional tuples, carries more than sixteen union-typed fields, or grows past a
grammar budget. The domain model breaks all four: its expression language is
recursive, comparisons are pairs, and nearly every element has a nullable
`source`.

So `lib/ingest/schemas.ts` defines a separate flat wire format with explicit
sentinels, and normalises it into the real types before anything is stored. Delta
extraction also splits into two concurrent calls — one for structure, one for
policy — which keeps each schema inside the budget and gives each call a single
job.

## The demo

Program A is seeded at v2 with twelve awards in flight, so the Inbox has
something to say on first load. Steps 4 and 5 run live against the real
extractor.

1. **To Review.** Three payments past their SLO, two approaching, two awaiting a
   CFO signature, one missing its evidence link. Switch role in the header — the
   same records, three different queues.
2. **Any record.** Fields, available actions with the reasons they are blocked,
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
| `lib/ingest/` | Extraction prompts, the model route, the fixture fallback |
| `lib/db/schema.ts` | Seven tables: documents, programs, program_versions, records, events, deltas, snoozes |
| `app/actions.ts` | Every write the app can perform |
| `samples/` | The sample documents |
| `components/` | The interface: split queue cards, program cards, the funnel, the explain and provenance panels |
| `design/figma-sample-data.md` | Copy and data for designing the screens |
| `design/programofficerview.png` | The design this interface follows |

Versions are rows, never updates. Records pin to the version they are being run
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

## Scripts

| Command | Does |
|---|---|
| `pnpm seed` | Reset to the demo's starting state |
| `pnpm fixtures` | Run the real extractors over `/samples` and commit the results as a fallback cache |
| `pnpm samples` | Re-embed `/samples` after editing them |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle migrations |

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
  otherwise.
- No auth. The role switcher is a cookie, which is the right trade for a demo
  whose point is that one set of records produces three different queues.
- No PDF parsing, no cross-program conflict detection beyond a shared-party flag,
  and no code generation.
