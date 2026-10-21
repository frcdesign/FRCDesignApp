# Quick fastener

## Purpose

Putting a screw, and a washer and nut where they're wanted, in each hole picked
in an assembly: sized to the hole, and long enough to go through everything on
its axis. It acts on whatever assembly Onshape launched the app from, under the
caller's own Onshape permissions; the library's access levels have no say over
it.

It inserts only standard fasteners: the lengths and parts the catalog says each
vendor makes. It has no FTC fasteners yet.

## Code map

| Path                                                                        | Role                                                                                         |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `scripts/sync-quick-fastener.js`                                            | `npm run sync:quick-fastener`: copies robot-code's manifest in at a pinned commit            |
| `src/backend/features/quick-fastener/catalog.gen.ts`                        | The synced catalog: studios, vendors, sizes, heads, screws, nuts, washers, seat washers      |
| `src/backend/features/quick-fastener/hole-scan.gen.ts`                      | The synced hole scan: the FeatureScript lambda evaluated in each Part Studio                 |
| `src/backend/features/quick-fastener/catalog.ts`                            | The catalog's types and lookups, and each studio's configuration; client-safe                |
| `src/backend/features/quick-fastener/contract.ts`                           | `FastenerOptions`, `QuickFastenerIn`, `PlannedHole`, `FastenerJobStatus` and the run's steps |
| `src/backend/features/quick-fastener/geometry.ts`                           | Vectors, Onshape's 4×4 transforms, `LINEAR_TOLERANCE`                                        |
| `src/backend/features/quick-fastener/scan.ts`                               | `scanStudio`: evaluates the hole scan, decodes it, caches it                                 |
| `src/backend/features/quick-fastener/assembly.ts`                           | Part occurrences and what pins each one's Part Studio; holes and circles in the assembly     |
| `src/backend/features/quick-fastener/gather.ts`                             | `gather`: reads the assembly and scans every Part Studio it needs                            |
| `src/backend/features/quick-fastener/planner.ts`                            | `planHoles`: the fastener for each hole; pure                                                |
| `src/backend/features/quick-fastener/insert.ts`                             | `placements`, the insert's groups, each part's fasten mate, washers' top edges               |
| `src/backend/features/quick-fastener/workflow.ts`                           | `QuickFastenerWorkflow`: a run, step by step                                                 |
| `src/backend/features/quick-fastener/jobs.ts`                               | `reportJob` and `getJobStatus`: the run an assembly last started                             |
| `src/backend/features/quick-fastener/failures.ts`                           | A failed step or run, in the user's words; which writes are retried                          |
| `src/backend/features/quick-fastener/routes.ts`                             | The two routes below                                                                         |
| `src/frontend/lib/selection.ts`                                             | Onshape's SELECTION messages, and the one query list taking picks                            |
| `src/frontend/components/query-list.tsx`                                    | `QueryList`: Onshape's query parameter, for entities picked in the Onshape window            |
| `src/frontend/features/quick-fastener/options.ts`                           | Default options, `consistentOptions`, `describePlan`                                         |
| `src/frontend/features/quick-fastener/store.ts`                             | The page's options and selection mode (kept) and picks (not)                                 |
| `src/frontend/features/quick-fastener/components/quick-fastener-panel.tsx`  | The page: the last run, the options, what to fasten, and Insert                              |
| `src/frontend/features/quick-fastener/components/fastener-options-form.tsx` | The options                                                                                  |
| `src/frontend/features/quick-fastener/components/last-run-callout.tsx`      | The run's step while it goes, then how it went                                               |
| `src/frontend/features/quick-fastener/components/job-details.tsx`           | The run's steps and each hole's plan                                                         |
| `src/frontend/features/quick-fastener/job-toasts.ts`                        | `useFastenerJobToasts`: a toast when a run finishes, from anywhere in the app                |
| `src/frontend/routes/app/quick-fastener.tsx`                                | The route; a notice outside an assembly                                                      |

robot-code (`robot-education/robot-code`) owns everything the catalog says:
`featurescripts/quickFastener/quickFastenerTables.py` generates the features'
FeatureScript data, the Part Studios' configurations, and the manifest synced
here, and `quickFastenerHoleScan.fs` is the hole scan.

## Storage

**KV** `quick-fastener-scan:{key}` — a Part Studio's holes, by part id, for a
month. The key is what pins the Part Studio's geometry and its configuration
(`toStudioSource`): `{documentId}|v|{versionId}|…` for a part from a version,
`{documentId}|e|{elementMicroversionId}|…` for one from the assembly's own
workspace, and `{documentId}|m|{documentMicroversionId}|…` otherwise.

**KV** `quick-fastener-mate-connector:{documentId}|{versionId}|{elementId}` —
the mate connector feature id a released studio's part has in an assembly,
with no expiry.

**KV** `fastener-job:{documentId}|{instanceId}|{elementId}` — the run an
assembly last started (`FastenerJobStatus`), for six hours: `RUNNING` with its
workflow run id and each step's state, then how it ended, with each hole's
plan once indexed.

**Workflow** `QUICK_FASTENER_WORKFLOW` (`QuickFastenerWorkflow`) — one instance
per run, given the caller's session id and the request.

**Browser** `quickFastener` in `localStorage` — the options and the selection
mode. What's picked is held only while the page is open.

## Flows

### Picking

1. Onshape sends `SELECTION` with the whole selection whenever it changes, once
   `applicationInit` has been sent; `parseSelections` keeps its entities.
2. Clicking a `QueryList` focuses it (one at a time, `useOnshapeSelection`) and
   shows its prompt in Onshape's bubble. Each later SELECTION hands the focused
   list what's new in it; the list keeps the edges and faces, and repeats its
   prompt for anything else.
3. Hovering a row lights its entity up (`requestSelectionHighlight`), and
   leaving it stops the request.

### Picking what to fasten

The panel's selection mode decides what the picks are:

- **Faces** — every circular edge of each face is a hole to fasten; _Holes to
  skip_ takes the edges of holes in them to leave out.
- **Locations** — each picked circular edge is a hole to fasten; nothing is
  skipped.

`insertBody` in `routes.ts` refuses a body whose picks don't match its mode.
Changing the mode clears the picks.

### Starting a run — `POST /api/quick-fastener/insert`

1. Answers 400 for FTC, 503 when the studios aren't released, and 409 while a
   run in the same assembly is still going (`getJobStatus`).
2. Creates a `QuickFastenerWorkflow` run with the caller's session id, stores
   it as `RUNNING` with every step pending, pushes, and answers that status.
   Picks are cleared on the page; the run goes on whether or not anyone stays.

### A run — `QuickFastenerWorkflow`

Each step reports itself started (`report-{action}`), then makes its Onshape
calls, each in a Workflow step of its own. A read is retried when its failure
is transient (`isTransient`); a write only when Onshape refused it with 429
before doing anything (`isRateLimited`), so a retry never inserts or mates
twice. A step that fails is recorded with why, and the steps after it are
skipped.

1. **Index holes** (`index`):
    1. Reads the assembly definition, and, when any part is from the
       assembly's own workspace, its Part Studios' microversions (one
       listing).
    2. Walks each occurrence into subassemblies to its part instance, and pins
       its Part Studio (`partOccurrences`).
    3. Scans each distinct pinned Part Studio once, six at a time: from the
       cache unless something is picked in it, by evaluating the hole scan
       otherwise, with the picked edges and faces as `qTransient` queries.
       Fasteners of the catalog's own studios and standard content aren't
       scanned.
    4. Moves every part's holes, and the picked circles (an edge's own, or
       every circular edge of a face), into the assembly; drops the skipped
       ones.
    5. `planHoles`, for each circle, with the chosen size and head:
        1. A Quick fastener screw already on its axis, seated there:
           **fastened**.
        2. Every hole on the axis, nearest first. The first must start at the
           circle (or within a flat head's countersink of it), and be at least
           the size's major diameter across.
        3. Follow the holes (`followStack`): into a hole tapped for the size
           (threads, or a hole at its tap drill narrower than the screw), to
           the bottom of a blind hole, or out the far side. **Max length**
           reaches across any gap and stops past the maximum length; **Respect
           gaps** stops at the first gap wider than the maximum gap, and past
           the vendor's longest screw.
        4. Washers (`chooseWashers`): the chosen washer type, from the screw's
           vendor when it makes washers in the size, else Generic. A start
           washer never goes under a flat head; an end washer only under a
           nut.
        5. Length, from the vendor's standard lengths for the size and head
           (within the maximum length under **Max length**): the shortest
           reaching through the stack, its washers, its nut and two threads
           past it; or the longest that engages a diameter of thread (or all
           there is) short of a blind hole's bottom by a thread. Preset, the
           chosen length.
        6. A nut only out the far side, and only with a nut type; from the
           screw's vendor if it makes nuts, else Generic.
    6. Stores each hole's plan with the status.
2. **Insert parts** (`insert`): places each ready hole's parts
   (`placements`) — the start washer on the circle and the screw on it, the
   end washer on the far side and the nut on it, turned over — and inserts
   them all in one `transformedinstances` call, from each studio's released
   version, with its configuration. Skipped when no hole is ready.
3. **Fasten parts**:
    1. Reads each studio's mate connector id from the assembly, once per
       release (`mate-connectors`).
    2. Scans the washer studio in each configuration placed, for its top edge
       (`washerTopEdge`): its hole's circle farthest up its Z axis
       (`washer-edges`).
    3. Adds one fasten mate per part, one at a time (`mate-{n}`): its mate
       connector to the center of what it sits on — a washer's top edge when
       it sits on a washer, else the hole's own edge.
4. **Finish** (`finish-job`): stores `COMPLETE` or `FAILED`, with how many
   parts were inserted and fastened, and when.

### Reporting

`reportJob` stores the status and pushes `FASTENER_JOB` with the assembly's
key, tagged with its workspace. A page on that assembly refetches
`GET /api/quick-fastener/job`, and does on reconnecting too. A stored
`RUNNING` is checked against its workflow run: once that has ended without
reporting, the running step reads failed and the rest skipped.

The page shows the run in a callout above the options — its step while it goes,
saying the page can be left, then how it went — with a Details modal listing
the steps and each hole's plan. `useFastenerJobToasts`, in the app shell, shows
a toast when a run watched going finishes, from any tab of the app.

## Invariants

- The catalog is robot-code's, synced at a pinned commit; it's never edited
  here.
- Only standard fasteners are inserted: a length, nut or washer the catalog
  says its vendor makes.
- A screw or nut on a washer is fastened to the inserted washer's top edge,
  and anything else to a hole's own edge, so no mate has an offset and any
  washer fits. The app always inserts screws and nuts with their Washer input
  off.
- A scan is keyed by something that never changes, so a cached scan is never
  stale and nothing invalidates it.
- Fasteners are only ever inserted into an assembly in a workspace.
- The plan inserted is the run's own, made in its index step; the client
  never sends one.
- One run at a time in an assembly.
- A write is retried only after a 429, so no part is inserted or mated twice.
- Onshape decides who may insert: the routes need a session, and every call
  a run makes is under the caller's own session.

## Failure and recovery

| Failure                              | Result                                                    | Recovery                                     |
| ------------------------------------ | --------------------------------------------------------- | -------------------------------------------- |
| The studios aren't released          | Insert answers 503                                        | Fill robot-code's `LOCATIONS`, sync          |
| The hole scan fails in a Part Studio | Index fails, naming Onshape's notice; the rest is skipped | Fix the Part Studio, or skip what's in it    |
| No hole, or nothing fits             | That hole's plan is **no fit**, with why                  | Change the options or the hole               |
| The insert fails                     | Nothing is inserted; fastening is skipped                 | Run it again                                 |
| A mate fails partway                 | The parts so far stay, some unmated                       | Mate the rest by hand, or undo and run again |
| Onshape rate-limits                  | The step retries, then fails as above                     | Run it again                                 |
| The run dies without reporting       | The job reads failed once the run has ended               | Run it again                                 |

## Decisions

- **Two repos, one generated file between them.** robot-code holds the
  FeatureScript and its tooling; this repo pins its manifest. Inserting needs a
  released Onshape version anyway, so a monorepo would still need the pin.
- **Immutable keys, no webhooks.** A version, a document microversion and a
  tab's microversion each name geometry that can't change, so a scan keyed by
  one is cached for good, and the assembly's own reading says which key is
  current. A Part Studio deriving from another tab of its workspace keeps its
  tab's microversion when only that other tab changes; this is untried in
  Onshape.
- **The panel listens instead of requesting.** Onshape sends every selection
  change once the app has said it's ready, so a focused list takes what's new
  rather than holding a `requestSelection` open, which a highlight would cancel.
- **Washers are mated to, not offset for.** Mate offsets aren't in Onshape's
  API reference. Fastening a screw or nut to the washer under it puts it at
  the washer's thickness whichever washer was chosen, where moving the mate
  connector by a seat washer would fit only that one.
- **A run, not a request, and no preview.** Indexing a large assembly and
  mating each part takes many Onshape calls, longer than anyone should wait on
  a panel; a workflow keeps going when the panel closes, and its stored status
  says what each hole got. Its plan is the preview.
- **The size is chosen, even in automatic mode.** A clearance hole fits more
  than one size, and a hole at 0.201" is both #10's clearance and 1/4-20's tap
  drill; the person knows which they meant. Automatic picks the length.
- **Every scan is sent the picked ids, not a `queries` body.** The lambda is
  wrapped to build its queries from `qTransient`, whose form std documents.

_Last reviewed: 2026-10-21_
