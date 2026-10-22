# Quick fastener

## Purpose

Putting a screw, and a washer and nut where they're wanted, in each hole picked
in an assembly: sized to the hole, and long enough to go through everything on
its axis. It acts on whatever assembly Onshape launched the app from, under the
caller's own Onshape permissions; the library's access levels have no say over
it.

It inserts only standard fasteners: the lengths and parts the catalog says each
vendor makes. It has no FTC fasteners yet.

Its screws, washers and nuts are FRCDesign's library fasteners: the same Part
Studios someone inserts from the library's Fasteners group. Each studio's
feature takes flat enums with no conditions, each wired to a configuration
input of the same options, and the configuration's visibility conditions show
only what's made.

robot-code (`robot-education/robot-code`) owns everything the catalog says:
`featurescripts/fasteners/fastenerTables.py` generates the features'
FeatureScript data, the Part Studios' configurations, and the manifest synced
here, and `fastenerHoleScan.fs` is the hole scan. The fasteners are a part set
(`[tool.fs.parts.fasteners]`): `fs parts fasteners --release` releases them
into FRCDesign's Fasteners library document, Part Studios and all, not to its
public frontend document. The studios are generated parts, synced by
`npm run sync:generated-parts` (see [generated-parts.md](./generated-parts.md)),
which also writes this area's `catalog.gen.ts`, `heads.gen.ts` and
`hole-scan.gen.ts` from the fasteners' manifest.

## Code map

Where to start reading, in the order a run goes: picking, the form, starting
a run, the run's steps, then reporting.

`src/frontend/lib/selection.ts` and `src/frontend/components/query-list.tsx`,
shared with insert and fasten

```ts
// Keeps a SELECTION message's entities, leaving out whole occurrences.
function parseSelections(data: unknown): OnshapeSelection[];
// The one focused list, and handing it each pick Onshape streams.
const useOnshapeSelection: UseBoundStore<StoreApi<SelectionState>>;
function onPick(listId: string, handler: PickHandler): () => void;
// Onshape's query parameter, for entities picked in the Onshape window.
function QueryList(props: QueryListProps): ReactNode;
```

`src/frontend/features/quick-fastener/parameters.ts`,
`src/frontend/features/quick-fastener/options.ts` and
`src/frontend/features/quick-fastener/store.ts`

```ts
const FORM_PARAMETERS: ConfigurationParameter[];
// The screw's Length, with Automatic first.
function lengthParameter(): EnumParameter;
// The choices as entered (kept) and the picks (not).
const useQuickFastenerStore: UseBoundStore<StoreApi<QuickFastenerState>>;
// Every studio's selection normalized, and each part into the screw's size.
function settleChoices(choices: Choices): SettledChoices;
// The run's options, its quantities in metres.
function fastenerOptions(settled: SettledChoices): FastenerOptions;
```

`src/frontend/features/quick-fastener/components/quick-fastener-panel.tsx`,
`src/frontend/features/quick-fastener/components/fastener-options-form.tsx`,
`src/frontend/features/quick-fastener/components/parameter-group.tsx` and
`src/frontend/components/parameter-input.tsx`

```ts
// The last run, the Selections group, the options, and Insert.
function QuickFastenerPanel(props: QuickFastenerPanelProps): ReactNode;
// The Fastener group, a group per washer and the nut, and the stop condition.
function FastenerOptionsForm(props: FastenerOptionsFormProps): ReactNode;
// Onshape's parameter groups, opened or driven by a checkbox.
function ParameterGroup(props: ParameterGroupProps): ReactNode;
```

`src/frontend/features/quick-fastener/queries.ts`

```ts
function useInsertMutation(assembly: ElementPath);
function useFastenerJobQuery(assembly: ElementPath | undefined);
```

`src/backend/features/quick-fastener/routes.ts`, `jobs.ts` and `contract.ts`

```text
POST /api/quick-fastener/insert    starts a run fastening the picked holes
GET  /api/quick-fastener/job?documentId=&instanceId=&elementId=    the run this assembly last started
```

```ts
async function reportJob(
    env: AppBindings,
    assembly: ElementPath,
    status: FastenerJobStatus
): Promise<void>;
// A stored RUNNING is checked against its workflow run.
async function getJobStatus(
    env: AppBindings,
    assembly: ElementPath
): Promise<FastenerJobStatus>;
function pendingTasks(options: FastenerOptions): FastenerTask[];
```

`src/backend/features/quick-fastener/workflow.ts`

```ts
// A run, step by step: index, insert, fasten, replicate, finish.
class QuickFastenerWorkflow extends WorkflowEntrypoint<
    AppBindings,
    FastenerJobParams
> {}
```

`src/backend/features/quick-fastener/gather.ts`,
`src/backend/features/quick-fastener/assembly.ts` and
`src/backend/features/quick-fastener/scan.ts`

```ts
// Reads the assembly and scans every Part Studio it needs.
async function gather(
    client: OnshapeApi,
    kv: KVNamespace,
    assembly: ElementPath,
    targets: SelectedEntity[],
    excluded: SelectedEntity[]
): Promise<Gathered>;
// Every part occurrence, through subassemblies, with the edit it's from.
function partOccurrences(
    definition: OnshapeAssemblyDefinition,
    assembly: ElementPath,
    microversions: ElementMicroversions
): PartOccurrence[];
// The cache key: what pins the Part Studio's geometry and configuration.
function toStudioSource(
    instance: OnshapeAssemblyInstance,
    assembly: ElementPath,
    microversions: ElementMicroversions
): StudioSource | undefined;
// From the cache when nothing is picked in it, else by evaluating the scan.
async function scanStudio(
    client: OnshapeApi,
    kv: KVNamespace,
    source: StudioSource,
    selection: StudioSelection
): Promise<StudioScan>;
```

`src/backend/features/quick-fastener/planner.ts`,
`src/backend/features/quick-fastener/catalog.ts` and
`src/backend/features/quick-fastener/studios.ts`

```ts
// The fastener for each hole; pure.
function planHoles(
    circularEdges: AssemblyCircularEdge[],
    holes: AssemblyHole[],
    placed: PlacedScrew[],
    options: FastenerOptions
): HolePlan[];
function getLengths(
    vendor: string,
    size: string,
    head: string,
    finish: string
): CatalogLength[];
// A part's overrides of its studio's defaults, as inserted.
function studioConfiguration(
    kind: FastenerKind,
    choice: ScrewChoice | PartChoice
): Selection;
```

`src/backend/features/quick-fastener/insert.ts`

```ts
// Each ready hole's parts, in two stacks, each part on the one under it.
function placements(plans: HolePlan[]): PartPlacement[];
// Alike holes together, each group's first the one given parts.
function replicateGroups(plans: HolePlan[]): HolePlan[][];
function insertGroups(
    parts: PartPlacement[]
): { instances: object[]; transform: number[] }[];
// Each studio's mate connector, read from the assembly once per release.
async function mateConnectorIdsFor(
    client: OnshapeApi,
    kv: KVNamespace,
    assembly: ElementPath,
    kinds: FastenerKind[]
): Promise<Partial<Record<FastenerKind, string>>>;
async function washerTopEdges(
    client: OnshapeApi,
    kv: KVNamespace,
    parts: PartPlacement[]
): Promise<Record<number, string>>;
function partMate(
    part: PartPlacement,
    path: string[],
    connectorId: string,
    paths: (string[] | undefined)[],
    washerEdges: Record<number, string>
): object | undefined;
// The screw stack's matches are the picked edges; the nut stack's, the far edges.
function stackMatch(
    group: HolePlan[],
    stack: PartStack,
    all: AssemblyCircularEdge[]
): ReplicateMatch;
```

`src/backend/features/quick-fastener/replicate.ts` and
`src/backend/lib/onshape/objects/assembly-features.ts`, shared with insert and
fasten

```ts
function replicateMatch(
    group: AssemblyCircularEdge[],
    all: AssemblyCircularEdge[]
): ReplicateMatch;
async function addReplicate(
    onshapeApi: OnshapeApi,
    assembly: ElementPath,
    args: ReplicateArgs
): Promise<void>;
function fastenMateToCircularEdge(
    name: string,
    query: object,
    edge: EdgeReference
): object;
```

`src/backend/features/quick-fastener/failures.ts`

```ts
// Why a step failed, in our words; Onshape's are for developers.
function describeStepFailure(
    error: unknown,
    action: FastenerTaskAction
): string;
function runFailure(message: string): Error;
```

`src/frontend/features/quick-fastener/job-report.ts`,
`src/frontend/features/quick-fastener/components/last-run-callout.tsx`,
`src/frontend/features/quick-fastener/components/job-details.tsx` and
`src/frontend/features/quick-fastener/job-toasts.ts`

```ts
function runningHeadline(status: FastenerJobStatus): string;
function jobHeadline(
    status: FastenerJobStatus,
    outcome: FastenerJobOutcome
): string;
// e.g. `#10-32 x 7/8 in Button head, Nylock nut`; or why the hole got nothing.
function describePlan(planned: PlannedHole): string;
function LastRunCallout(props: LastRunCalloutProps): ReactNode;
function JobDetails(props: JobDetailsProps): ReactNode;
// A toast when a run finishes, from anywhere in the app.
function useFastenerJobToasts(): void;
```

`src/frontend/routes/app/quick-fastener.tsx` is the route, with a notice
outside an assembly. `src/backend/features/quick-fastener/geometry.ts` holds
vectors, Onshape's 4×4 transforms and `LINEAR_TOLERANCE`.

## Storage

- **KV** `quick-fastener-scan:{key}` — a Part Studio's holes, by part id, for a
  month. The key is what pins the Part Studio's geometry and its configuration
  (`toStudioSource`): `{documentId}|v|{versionId}|…` for a part from a version,
  `{documentId}|e|{elementMicroversionId}|…` for one from the assembly's own
  workspace, and `{documentId}|m|{documentMicroversionId}|…` otherwise.
- **KV** `quick-fastener-mate-connector:{documentId}|{versionId}|{elementId}` —
  the mate connector feature id a released studio's part has in an assembly,
  with no expiry.
- **KV** `fastener-job:{documentId}|{instanceId}|{elementId}` — the run an
  assembly last started (`FastenerJobStatus`), for six hours: `RUNNING` with
  its workflow run id and each step's state, then how it ended, with each
  hole's plan once indexed.
- **Workflow** `QUICK_FASTENER_WORKFLOW` (`QuickFastenerWorkflow`) — one
  instance per run, given the caller's session id and the request.
- **localStorage** `quickFastener` (version 1) — the choices as entered: the
  form's own values, the mode, each part's values and which are added. An
  earlier version's are dropped.
- **Memory** — what's picked, only while the page is open.

## Flows

### Picking

1. Once the app sends `applicationInit`, Onshape streams a `SELECTION` message
   for each pick as it's made, not the whole selection; `parseSelections` keeps
   its entities.
2. Clicking a `QueryList` focuses it (one at a time, `useOnshapeSelection`) and
   shows its prompt in Onshape's bubble. Each pick goes to the focused list,
   which keeps the edges and faces it doesn't hold yet, and repeats its prompt
   for anything else. With no list focused, picks are dropped.
3. Hovering a row lights its entity up (`requestSelectionHighlight`, each with
   its own message id), and leaving it stops the request. Onshape's answers to
   a highlight are logged at debug level.

### The form

The panel is a `ParameterGrid` of the configuration dialog's own inputs
(`ParameterInput`), in groups as Onshape's feature dialogs group them:

1. **Selections**: _Select by_ (Faces or Circular edges), and its query lists.
2. **Fastener**: Program, then the screw studio's Vendor, Size, Head and
   Finish, its Length with **Automatic** first (a length is preset mode,
   Automatic picks one per hole), and, beside a preset length sold both ways,
   its Fully threaded. Then **Replicate**, off by default.
3. **Add screw washer**, **Add nut** and **Add nut washer**, each a group its
   checkbox shows: the washer or nut studio's parameters but its Size, which is
   the screw's. Its Vendor offers those making it in that size, and is left out
   under a Generic screw, whose parts are Generic. A washer's Finish shows where
   its vendor sells more than black. The screw washer is gone under a
   countersunk head, and the nut washer without a nut.
4. Automatic only: _Stop condition_ (**Max length** with its length, or **First
   gap** with the widest gap to ignore), and _Max thread depth_.

The studios' parameters are their configurations as Onshape answers them,
parsed by `parseOnshapeConfiguration`, so their options show as the Part
Studios show them. What's stored is settled on every read (`settleChoices`):
each studio's selection through `normalizeSelection`, and each part into the
screw's size from a vendor making it (`settlePart`: the one chosen, else the
screw's, else Generic). Changing the screw's vendor moves every part to it,
where it makes them.

### Picking what to fasten

_Select by_ decides what the picks are:

- **Faces** — every circular edge of each face is a hole to fasten; _Holes to
  skip_ takes the edges of holes in them to leave out.
- **Circular edges** — each picked circular edge is a hole to fasten; nothing
  is skipped.

`insertBody` in `routes.ts` refuses a body whose picks don't match its mode,
and a part its studio doesn't make (`isMade`) or not in the screw's size.
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
    1. Reads the assembly definition, and, when any part is from the assembly's
       own workspace, its Part Studios' microversions (one listing).
    2. Walks each occurrence into subassemblies to its part instance, and pins
       its Part Studio (`partOccurrences`).
    3. Scans each distinct pinned Part Studio once, six at a time: from the
       cache unless something is picked in it, by evaluating the hole scan
       otherwise, with the picked edges and faces as `qTransient` queries.
       Fasteners of the catalog's own studios and standard content aren't
       scanned.
    4. Moves every part's holes, and the picked circular edges (an edge's own,
       or every circular edge of a face), into the assembly; drops the skipped
       ones.
    5. `planHoles`, for each circular edge, with the chosen screw's size and
       head:
        1. A library screw already on its axis, seated there: **fastened**.
        2. Every hole on the axis, nearest first. The first must start at the
           circular edge (or within a flat head's countersink of it), and be at
           least the size's major diameter across.
        3. Follow the holes (`followStack`): into a hole tapped for the size
           (threads, or a hole at its tap drill narrower than the screw), to the
           bottom of a blind hole, or out the far side. **Max length** reaches
           across any gap and stops past the maximum length; **First gap** stops
           at the first gap wider than the maximum gap, and past the vendor's
           longest screw.
        4. Washers (`chooseWashers`): the screw washer chosen, never under a
           flat head; the nut washer only under a nut.
        5. Length, from the lengths the vendor makes the size and head in, in
           the finish chosen (`getLengths`; within the maximum length under
           **Max length**), partly threaded: the shortest reaching through the
           stack, its washers, its nut and two threads past it; or, into
           threads or a blind hole, the longest reaching no farther than the
           maximum thread depth past where they start and a thread short of a
           blind hole's bottom, that still engages a diameter of thread (or all
           there is, or the maximum thread depth). Preset, the chosen length,
           fully threaded if chosen, short of the bottom.
        6. The nut chosen, only out the far side, with the far side's circular
           edge and its radius.
    6. Stores each hole's plan with the status.
2. **Insert parts** (`insert`): places each ready hole's parts (`placements`)
   in two stacks — the screw washer on the circular edge and the screw on it;
   the nut washer on the far side's edge and the nut on it, turned over — and
   inserts them all in one `transformedinstances` call, from each studio's
   released version, with its configuration. Skipped when no hole is ready.
   With **Replicate**, the ready holes are grouped first (`replicateGroups`):
   holes given the same parts, as deep, through circular edges of the same
   size and out far edges of the same size, in the order found. Only each
   group's first hole gets parts here.
3. **Fasten parts**:
    1. Reads each studio's mate connector id from the assembly, once per
       release (`mate-connectors`).
    2. Scans the washer studio in each configuration placed, for its top edge
       (`washerTopEdge`): its hole's circular edge farthest up its Z axis
       (`washer-edges`).
    3. Adds one fasten mate per part, one at a time (`mate-{n}`): its mate
       connector to an implicit connector at the center of what it sits on
       (`fastenMateToCircularEdge`, as insert and fasten mates). A washer is
       fastened to its stack's hole edge, and the screw or nut on it to the
       washer's top edge; without a washer, the screw or nut is fastened to the
       hole edge itself.
4. **Replicate parts**, only with **Replicate**: for each group of more than
   one hole, one at a time, a Replicate per stack of the first hole's parts
   (`replicate-{n}-screw`, then `replicate-{n}-nut`), each seeded with the
   stack's parts and placed as the mate holding its bottom part on its edge
   (`addReplicate`). The screw stack's matches the faces the group's circular
   edges are on when the group is every edge of its size on whole picked faces
   (none skipped, none planned otherwise), and the edges otherwise
   (`replicateMatch`); the nut stack's matches the group's far edges one by
   one (`stackMatch`). Onshape refusing one fails the step, with Onshape's
   message, and the Replicates after it aren't added.
5. **Finish** (`finish-job`): stores `COMPLETE` or `FAILED`, with how many parts
   were inserted and fastened, how many holes its Replicates filled, and when.

### Reporting

`reportJob` stores the status and pushes `FASTENER_JOB` with the assembly's
key, tagged with its workspace. A page on that assembly refetches
`GET /api/quick-fastener/job`, and does on reconnecting too. A stored `RUNNING`
is checked against its workflow run: once that has ended without reporting, the
running step reads failed and the rest skipped.

The page shows the run in a callout above the options — its step while it
goes, saying the page can be left, then how it went — with a Details modal
listing the steps and each hole's plan. `useFastenerJobToasts`, in the app
shell, shows a toast when a run watched going finishes, from any tab of the
app.

## User-facing strings

| String                                                                                                                           | Where                                                      |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| "Open an assembly to fasten parts"                                                                                               | Route notice title, outside an assembly                    |
| "Quick Fastener puts screws, washers and nuts in the holes of an assembly's parts. Open it from an assembly's panel."            | Route notice description, outside an assembly              |
| "Sign in to fasten parts" / "Sign in"                                                                                            | Route notice title and button, signed out                  |
| "Quick Fastener reads your assembly's holes and inserts fasteners into it."                                                      | Route notice description, signed out                       |
| "Selections"                                                                                                                     | Group title                                                |
| "Select by" / "Faces" / "Circular edges"                                                                                         | Selection mode, its options                                |
| "Faces"                                                                                                                          | Targets list's label, faces                                |
| "Select faces to fasten every hole in."                                                                                          | Targets list's prompt, faces, in Onshape's bubble and list |
| "Holes to skip"                                                                                                                  | Second list's label, faces                                 |
| "Select the edges of holes to leave out."                                                                                        | Holes to skip's prompt                                     |
| "Circular edges"                                                                                                                 | Targets list's label, circular edges                       |
| "Select the circular edges of holes to fasten."                                                                                  | Targets list's prompt, circular edges                      |
| "Click to select"                                                                                                                | An empty list, not focused (`QueryList`)                   |
| "{Kind} {n}", e.g. "Edge 1"                                                                                                      | A list's row                                               |
| "Fastener"                                                                                                                       | Group title                                                |
| "Program" / "FRC" / "FTC"                                                                                                        | Program, its options                                       |
| "FTC fasteners aren't available yet."                                                                                            | In place of the Fastener group's inputs, FTC               |
| "Automatic"                                                                                                                      | The screw's Length, first option                           |
| "Replicate"                                                                                                                      | Checkbox                                                   |
| "Add screw washer" / "Add nut" / "Add nut washer"                                                                                | Group titles, each a checkbox                              |
| "Stop condition" / "Max length" / "First gap"                                                                                    | Stop condition, its options                                |
| "Max length" / "Max gap to ignore" / "Max thread depth"                                                                          | Length inputs                                              |
| "Insert"                                                                                                                         | Button                                                     |
| "Unexpectedly failed to start inserting."                                                                                        | Error toast, the request failed                            |
| "Quick fastener doesn't have FTC fasteners yet."                                                                                 | Error, insert route (400)                                  |
| "Quick fastener's parts aren't published yet."                                                                                   | Error, insert route (503)                                  |
| "Fasteners are already being inserted in this assembly."                                                                         | Error, insert route (409)                                  |
| "Every part must be one its vendor makes, in the screw's size."                                                                  | Validation error, insert route                             |
| "A nut washer goes under a nut."                                                                                                 | Validation error, insert route                             |
| "Index holes" / "Insert parts" / "Fasten parts" / "Replicate parts"                                                              | Details modal, the steps                                   |
| "{Indexing holes \| Inserting parts \| Fastening parts \| Replicating parts \| Inserting fasteners}... You can leave this page." | Callout, while running                                     |
| "{headline} {time ago}."                                                                                                         | Callout, finished                                          |
| "Inserted {n} parts" / "Inserted {n} parts, replicated onto {m} holes"                                                           | Headline, succeeded                                        |
| "{parts}, with problems"                                                                                                         | Headline, partly                                           |
| "Couldn't insert fasteners"                                                                                                      | Headline, failed                                           |
| "Details"                                                                                                                        | Callout button, and the finished toast's action            |
| "{headline}."                                                                                                                    | Toast, when a watched run finishes                         |
| "No recent run" / "Loading..." / "{running headline}..."                                                                         | Details modal title                                        |
| "Stopped early."                                                                                                                 | Details modal notice, with the run's error                 |
| "Holes"                                                                                                                          | Details modal, the plans' heading                          |
| "{size} x {length} {head}[ ({finish}, fully threaded)], {nut type} nut" / "…, through"                                           | A ready hole's plan (`describePlan`)                       |
| "into threads" / "into a blind hole"                                                                                             | A ready hole's plan, its end, without a nut                |
| "Already fastened" / "Can't be fastened"                                                                                         | A hole's plan                                              |
| "The head isn't made in this size."                                                                                              | A hole's plan, no fit                                      |
| "No hole goes into the part from this circular edge."                                                                            | A hole's plan, no fit                                      |
| "The hole is too small for a {size} screw."                                                                                      | A hole's plan, no fit                                      |
| "The vendor doesn't make this head in this size."                                                                                | A hole's plan, no fit                                      |
| "The vendor doesn't make this length in this size and head."                                                                     | A hole's plan, no fit, preset                              |
| "No screw reaches through within the maximum length." / "No screw is long enough to reach through."                              | A hole's plan, no fit, through                             |
| "The screw is too long or too short for this hole."                                                                              | A hole's plan, no fit, preset into threads                 |
| "No screw length engages the threads within the maximum thread depth without bottoming out."                                     | A hole's plan, no fit, tapped                              |
| "No screw length fits the blind hole within the maximum thread depth."                                                           | A hole's plan, no fit, blind                               |
| "No edge on the far side to fasten a nut to."                                                                                    | A hole's plan, ready without its nut                       |
| "Quick fastener stopped: {why}"                                                                                                  | The run's error                                            |
| "Couldn't read the assembly's holes." / "Couldn't insert the fasteners."                                                         | A step's failure, index / insert                           |
| "Couldn't fasten the inserted parts." / "Couldn't replicate the inserted parts."                                                 | A step's failure, fasten / replicate                       |
| "You don't have permission to edit this assembly."                                                                               | A step's failure, Onshape answered 403                     |
| "The inserted fastener has no mate connector to fasten."                                                                         | Fasten step's failure                                      |
| "A hole's parts weren't all inserted and fastened, so they can't be replicated."                                                 | Replicate step's failure                                   |
| "Onshape refused the Replicate ({Onshape's message})."                                                                           | Replicate step's failure                                   |

## Invariants

- The catalog is robot-code's, synced at a pinned commit; it's never edited
  here.
- Only standard fasteners are inserted: a length, nut or washer the catalog says
  its vendor makes.
- A hole's parts are two stacks, each held together by its own mates: a washer
  is fastened to its stack's hole edge, the screw or nut on it to the washer's
  top edge, and without a washer the screw or nut to the hole edge. No mate has
  an offset, and any washer fits. The studios have no Washer input.
- A Replicate's seed is one stack's parts, and its seed mate is the one holding
  that stack's bottom part on its edge: the screw stack copies onto circular
  edges, the nut stack onto far edges, never one onto the other's.
- A Replicate only fills holes alike its first one's: the same parts, as deep,
  through a circular edge of the same size and out a far edge of the same size,
  so each copy sits as the stack it copies.
- The form's studio parameters are the studios' own configurations, parsed as
  any configuration is, and a part is inserted with its selection's overrides
  (`studioConfiguration`, through `onshapeOverrides`): the client and the Part
  Studio can't disagree on what's offered.
- Every part is in the screw's size.
- A scan is keyed by something that never changes, so a cached scan is never
  stale and nothing invalidates it.
- Fasteners are only ever inserted into an assembly in a workspace.
- The plan inserted is the run's own, made in its index step; the client never
  sends one.
- One run at a time in an assembly.
- A write is retried only after a 429, so no part is inserted or mated twice.
- Picks reach only the focused list; a list never holds the same entity twice.
- Onshape decides who may insert: the routes need a session, and every call a
  run makes is under the caller's own session.

## Failure and recovery

| Failure                              | Result                                                                                                       | Recovery                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| The studios aren't released          | Insert answers 503                                                                                           | Release them in robot-code, sync                   |
| The hole scan fails in a Part Studio | Index fails, naming Onshape's notice; the rest is skipped                                                    | Fix the Part Studio, or skip what's in it          |
| No hole, or nothing fits             | That hole's plan is **no fit**, with why                                                                     | Change the options or the hole                     |
| The insert fails                     | Nothing is inserted; fastening is skipped                                                                    | Run it again                                       |
| A mate fails partway                 | The parts so far stay, some unmated                                                                          | Mate the rest by hand, or undo and run again       |
| Onshape refuses a Replicate          | Replicate fails, saying why; the holes it and those after it were for stay empty, or hold only a screw stack | Run without Replicate, or report Onshape's message |
| A Replicate fails to regenerate      | It stays in the assembly, with its error                                                                     | Fix or delete it in Onshape                        |
| Onshape rate-limits                  | The step retries, then fails as above                                                                        | Run it again                                       |
| The run dies without reporting       | The job reads failed once the run has ended                                                                  | Run it again                                       |

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
- **The panel listens to the stream.** Onshape streams every pick once the app
  has sent `applicationInit`; `requestSelection` only limits what the graphics
  window lets be picked, and a highlight cancels it. The panel sends none, so a
  focused list refuses kinds it doesn't take itself.
- **Washers are mated to, not offset for.** Mate offsets aren't in Onshape's
  API reference. Fastening a screw or nut to the washer under it puts it at the
  washer's thickness whichever washer was chosen, where moving the mate
  connector by a seat washer would fit only that one.
- **A Replicate per stack.** Onshape's Replicate copies several instances
  together, placed as one seed mate places its part, so a stack fastened
  together copies as one. The nut stack sits on another edge than the screw's,
  so it takes a Replicate of its own, seeded by its own mate.
- **A run, not a request, and no preview.** Indexing a large assembly and
  mating each part takes many Onshape calls, longer than anyone should wait on
  a panel; a workflow keeps going when the panel closes, and its stored status
  says what each hole got. Its plan is the preview.
- **The form is the configuration dialog's.** Its studio parameters are the
  Part Studios' configurations as Onshape answers them, rendered and settled by
  the code the insert menu uses, so a vendor's options show as they do in
  Onshape and nothing restates the lookup table. Quick fastener's own
  parameters are `ConfigurationParameter`s too, but without conditions: the
  form decides what shows, so a hidden choice keeps its value.
- **Each part has its own vendor.** Not every vendor sells washers or nuts, and
  someone using one vendor's screws may buy another's nuts. Under a Generic
  screw the parts are Generic, and their Vendor isn't asked.
- **Replicate is off by default.** Onshape publishes no spec for Replicate;
  `replicateFeature` is copied from a Replicate matching edges on a face, and
  matching individual edges is unconfirmed. It shares insert and fasten's
  Replicate and mate code, so one fix there fixes both.
- **No fallbacks.** Onshape refusing a write fails its step with Onshape's
  message rather than being worked around.
- **An automatic screw is partly threaded.** The screw studio asks Fully
  threaded only of a length, so automatic sizing has nothing to ask it of; its
  finish, chosen before the length, it keeps.
- **The size is chosen, even in automatic mode.** A clearance hole fits more
  than one size, and a hole at 0.201" is both #10's clearance and 1/4-20's tap
  drill; the person knows which they meant. Automatic picks the length.
- **Every scan is sent the picked ids, not a `queries` body.** The lambda is
  wrapped to build its queries from `qTransient`, whose form std documents.

_Last reviewed: 2026-10-22_
