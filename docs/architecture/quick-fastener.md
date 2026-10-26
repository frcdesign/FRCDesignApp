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
FeatureScript data, the Part Studios' configurations, and the manifest released
beside them. The fasteners are a
part set (`[tool.fs.parts.fasteners]`): `fs parts fasteners --release` releases
them into FRCDesign's Fasteners library document, Part Studios and all, not to
its public frontend document. They're generated parts (see
[generated-parts.md](./generated-parts.md)): loading FRCDesignLib's Fasteners
group stores the manifest's catalog and loads each studio, and Quick fastener
reads both (`FastenerSet`). The hole scan is the app's own
(`src/backend/features/quick-fastener/hole-scan.fs`), beside the code that
parses its answer.

## Code map

Where to start reading, in the order a run goes: picking, the form, starting
a run, the run's steps, then reporting.

`src/frontend/lib/selection.ts` and `src/frontend/components/query-list.tsx`,
shared with insert and fasten

```ts
// Keeps a SELECTION message's entities, leaving out whole occurrences.
function parseSelections(data: unknown): OnshapeSelection[];
// The one focused list, and handing it how the window's selection changed.
const useOnshapeSelection: UseBoundStore<StoreApi<SelectionState>>;
function onPick(listId: string, handler: PickHandler): () => void;
// Says the app made the window show a selection, so its SELECTION messages aren't picks.
function expectSelection(selection: OnshapeSelection[]): void;
function expectCleared(): void;
// Onshape's query parameter, for entities picked in the Onshape window.
function QueryList(props: QueryListProps): ReactNode;

interface OnshapeSelection {
    entityType: string;
    /** Its deterministic id in the Part Studio it's from. */
    selectionId: string;
    /** The part occurrence it's on, from the assembly down. */
    occurrencePath: string[];
}

interface SelectionState {
    /** The query list taking picks; none takes them when absent. */
    focused?: string;
    /** What the Onshape window last said it has selected. */
    shown: OnshapeSelection[];
    /** A selection the app asked Onshape to show, until it arrives or a second passes. */
    awaited?: { keys: string; until: number };
    /** Takes a SELECTION message's whole selection. */
    receive: (selection: OnshapeSelection[]) => void;
    focus: (listId: string | undefined) => void;
}

interface SelectionChange {
    added: OnshapeSelection[];
    removed: OnshapeSelection[];
}

type PickHandler = (change: SelectionChange) => void;

interface QueryListProps {
    /** Unique on the page: which list takes picks. */
    id: string;
    label: string;
    /** What to pick, shown while it's focused, and when something else is picked. */
    prompt: string;
    entities: OnshapeSelection[];
    onChange: (entities: OnshapeSelection[]) => void;
    /** Which picks it takes; the rest are refused. */
    accepts: (entity: OnshapeSelection) => boolean;
    /** What the Onshape window lets be picked while it's focused. */
    filter: SelectionFilter;
    /** A row's name; its kind and number by default. */
    describe?: (entity: OnshapeSelection, index: number) => string;
    /** Beside a row's name: a status, say. */
    rowSection?: (entity: OnshapeSelection) => ReactNode;
}
```

`src/frontend/features/quick-fastener/parameters.ts`,
`src/frontend/features/quick-fastener/options.ts` and
`src/frontend/features/quick-fastener/store.ts`

```ts
const FORM_PARAMETERS: ConfigurationParameter[];
// Sizing: Automatic (a length per hole) or Manual (the screw's Length).
const SIZING_PARAMETER: EnumParameter;
// The choices as entered (kept) and the picks (not).
const useQuickFastenerStore: UseBoundStore<StoreApi<QuickFastenerState>>;
// Every studio's selection normalized, and each part into the screw's size.
function settleChoices(set: FastenerSet, choices: Choices): SettledChoices;
// The run's options, its quantities in metres.
function fastenerOptions(settled: SettledChoices): FastenerOptions;

interface QuickFastenerState extends Choices {
    targets: OnshapeSelection[];
    excluded: OnshapeSelection[];
    setForm: (id: FormInput, value: string) => void;
    setMode: (mode: FastenerMode) => void;
    setScrew: (id: string, value: string) => void;
    setPart: (part: Part, id: string, value: string) => void;
    setAdded: (part: Part, added: boolean) => void;
    setTargets: (targets: OnshapeSelection[]) => void;
    setExcluded: (excluded: OnshapeSelection[]) => void;
}

interface Choices {
    /** Quick fastener's own parameters. */
    form: PartialSelection;
    mode: FastenerMode;
    screw: PartialSelection;
    parts: Record<Part, PartialSelection>;
    added: Record<Part, boolean>;
}

interface SettledChoices {
    /** What they were settled onto. */
    set: FastenerSet;
    form: Selection;
    mode: FastenerMode;
    screw: ScrewChoice;
    /** Undefined where nobody makes the part in the screw's size. */
    parts: Record<Part, PartChoice | undefined>;
    /** Which parts go in: added, made in the size, and allowed by the rest. */
    added: Record<Part, boolean>;
}

enum FormInput {
    SELECT_BY = "selectBy",
    PROGRAM = "program",
    STOP = "stop",
    MAX_LENGTH = "maxLength",
    MAX_GAP = "maxGap",
    MAX_THREAD_DEPTH = "maxThreadDepth"
}

enum Part {
    SCREW_WASHER = "screwWasher",
    NUT = "nut",
    NUT_WASHER = "nutWasher"
}
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

interface QuickFastenerPanelProps {
    assembly: ElementPath;
}

interface FastenerOptionsFormProps {
    settled: SettledChoices;
}

interface ParameterGroupProps {
    title: string;
    /** A checkbox in its header, which shows its rows while ticked. */
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    children?: ReactNode;
}
```

`src/frontend/features/quick-fastener/queries.ts`

```ts
// The fasteners the library loaded; null before it loads them.
function useFastenerSetQuery();
function useInsertMutation(assembly: ElementPath);
function useFastenerJobQuery(assembly: ElementPath | undefined);
```

`src/backend/features/quick-fastener/routes.ts`, `jobs.ts` and `contract.ts`

```text
GET  /api/quick-fastener/parts     the fasteners the library loaded, or null
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
function pendingTasks(): FastenerTask[];

interface FastenerOptions {
    program: Program;
    mode: FastenerMode;
    /** Its length is the preset's, and automatic picks one in its place. */
    screw: ScrewChoice;
    /** Under the head; none when absent. */
    screwWasher?: PartChoice;
    /** Where the screw comes out the far side; none when absent. */
    nut?: PartChoice;
    /** Under the nut; only with one. */
    nutWasher?: PartChoice;
    stop: StopCondition;
    /** Metres; what `StopCondition.MAX_LENGTH` stops at. */
    maxLength: number;
    /** Metres; the widest gap `StopCondition.FIRST_GAP` reaches across. */
    maxGap: number;
    /** Metres; the farthest an automatic screw goes past where threads, or a blind hole, start. */
    maxThreadDepth: number;
}

enum FastenerMode {
    /** Long enough for each hole, from what it goes through. */
    AUTOMATIC = "automatic",
    /** One length, wherever it's put. */
    PRESET = "preset"
}

enum StopCondition {
    /** Through every hole on the axis, gaps and all, up to the maximum length. */
    MAX_LENGTH = "max-length",
    /** At the first gap between parts wider than the maximum gap. */
    FIRST_GAP = "first-gap"
}

interface FastenerJobStatus {
    state: FastenerJobState;
    jobId?: string;
    tasks?: FastenerTask[];
    /** Each hole picked, and what it got or why it got nothing, once indexed. */
    holes?: PlannedHole[];
    result?: FastenerJobResult;
    /** Why the whole run stopped, when it did. Written for the user. */
    error?: string;
    /** When it ended, in epoch milliseconds. */
    finishedAt?: number;
}

interface FastenerTask {
    action: FastenerTaskAction;
    state: FastenerTaskState;
    /** Why it failed, written for the user. */
    reason?: string;
}

enum FastenerJobState {
    /** No run has been started in this assembly, or the last one aged out. */
    NONE = "none",
    RUNNING = "running",
    COMPLETE = "complete",
    FAILED = "failed"
}

interface PlannedHole {
    /** The circular edge's occurrence path and edge id, joined. */
    key: string;
    status: HoleStatus;
    /** Why it can't be fastened, in words, when it can't. */
    reason?: string;
    end?: HoleEnd;
    /** Metres, from the circular edge to where the stack ends. */
    depth?: number;
    screw?: ScrewChoice;
    screwWasher?: PartChoice;
    nut?: PartChoice;
    nutWasher?: PartChoice;
}

interface FastenerJobResult {
    /** Parts inserted. */
    inserted: number;
    /** Parts fastened to where they sit. */
    fastened: number;
    /** Holes a Replicate filled, rather than parts inserted in each. */
    replicated: number;
}

enum FastenerTaskAction {
    INDEX = "index",
    INSERT = "insert",
    FASTEN = "fasten",
    /** Skipped when no two holes are alike. */
    REPLICATE = "replicate"
}

enum FastenerTaskState {
    PENDING = "pending",
    RUNNING = "running",
    DONE = "done",
    FAILED = "failed",
    /** Not tried, since an earlier step failed or left it nothing to do. */
    SKIPPED = "skipped"
}

enum HoleStatus {
    READY = "ready",
    /** A library screw is already in it. */
    FASTENED = "fastened",
    /** Nothing in the catalog fits, or reaches far enough within the maximum length. */
    NO_FIT = "no-fit"
}

enum HoleEnd {
    /** Out the far side, where a nut goes. */
    THROUGH = "through",
    /** In threads. */
    TAPPED = "tapped",
    /** At the bottom of a hole without threads. */
    BLIND = "blind"
}

interface QuickFastenerIn {
    assembly: ElementPath;
    selectionMode: SelectionMode;
    /** Faces to fasten every hole in, or the holes' edges, by `selectionMode`. */
    targets: SelectedEntity[];
    /** The edges of holes in `targets` to leave out; faces only. */
    excluded: SelectedEntity[];
    options: FastenerOptions;
}

enum SelectionMode {
    FACES = "faces",
    LOCATIONS = "locations"
}

interface SelectedEntity {
    occurrencePath: string[];
    /** Its deterministic id in the Part Studio it's from. */
    entityId: string;
    entityType: SelectedEntityType;
}

enum SelectedEntityType {
    EDGE = "EDGE",
    FACE = "FACE"
}

enum FastenerJobOutcome {
    SUCCESS = "success",
    /** Some holes or parts weren't done, after something was. */
    PARTIAL = "partial",
    FAILED = "failed"
}
```

`src/backend/features/quick-fastener/workflow.ts`

```ts
// A run, step by step: index, insert, fasten, replicate, finish.
class QuickFastenerWorkflow extends WorkflowEntrypoint<
    AppBindings,
    FastenerJobParams
> {}

interface FastenerJobParams {
    /** Whose Onshape session the run borrows; see the load workflow. */
    sessionId: string;
    request: QuickFastenerIn;
}
```

`src/backend/features/quick-fastener/index-holes.ts`,
`src/backend/features/quick-fastener/assembly.ts`,
`src/backend/features/quick-fastener/scan.ts` and
`src/backend/features/quick-fastener/hole-scan.fs`

```ts
// Reads the assembly and scans every Part Studio it needs.
async function indexHoles(
    client: OnshapeApi,
    kv: KVNamespace,
    assembly: ElementPath,
    targets: SelectedEntity[],
    excluded: SelectedEntity[],
    fasteners: FastenerSet | undefined
): Promise<IndexedHoles>;
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
// hole-scan.fs's fastenerHoleScan body, as the lambda Onshape evaluates.
function holeScanLambda(source: string): string;
// From the cache when nothing is picked in it, else by evaluating the scan.
async function scanStudio(
    client: OnshapeApi,
    kv: KVNamespace,
    source: StudioSource,
    selection: StudioSelection
): Promise<StudioScan>;

interface IndexedHoles {
    circularEdges: AssemblyCircularEdge[];
    holes: AssemblyHole[];
    placed: PlacedScrew[];
    /** Each target that gave no circular edge, and why. */
    unfound: PlannedHole[];
}

type ElementMicroversions = Map<string, string>;

interface PartOccurrence {
    path: string[];
    transform: number[];
    partId: string;
    documentId: string;
    elementId: string;
    isStandardContent: boolean;
    source: StudioSource;
}

interface StudioSource {
    /** A version, a document microversion, or a workspace with `elementMicroversionId`. */
    path: ElementPath;
    configuration?: string;
    elementMicroversionId?: string;
    /** What pins it: the same key is always the same geometry. */
    key: string;
}

interface StudioSelection {
    edges: string[];
    faces: string[];
}

type StudioScan = z.infer<typeof scanSchema>;
```

`src/backend/features/quick-fastener/fastener-set.ts`,
`src/backend/features/quick-fastener/planner.ts`,
`src/backend/features/quick-fastener/catalog.ts` and
`src/backend/features/quick-fastener/studios.ts`

```ts
// The catalog FRCDesignLib's last load stored and each kind's loaded studio;
// undefined until there are both, or when the catalog isn't one this reads.
async function getFastenerSet(
    db: Db,
    libraryId: LibraryId = FASTENER_LIBRARY
): Promise<FastenerSet | undefined>;
// The fastener for each hole; pure.
function planHoles(
    circularEdges: AssemblyCircularEdge[],
    holes: AssemblyHole[],
    placed: PlacedScrew[],
    options: FastenerOptions,
    catalog: Catalog
): HolePlan[];
function getLengths(
    catalog: Catalog,
    vendor: string,
    size: string,
    head: string,
    finish: string
): CatalogLength[];
// Each studio input settled onto what's made: hidden and fixed ones from the catalog.
function settleScrew(set: FastenerSet, choice: PartialSelection): ScrewChoice;
// A part's overrides of its studio's defaults, as inserted.
function studioConfiguration(
    set: FastenerSet,
    kind: FastenerKind,
    choice: ScrewChoice | PartChoice
): Selection;

interface ScrewChoice {
    vendor: string;
    size: string;
    head: string;
    finish: string;
    length: string;
    fullyThreaded: string;
}

interface PartChoice {
    vendor: string;
    size: string;
    type: string;
    finish?: string;
}

enum Program {
    FRC = "frc",
    FTC = "ftc"
}

interface AssemblyCircularEdge {
    key: string;
    occurrencePath: string[];
    edgeId: string;
    center: Vec3;
    /** Unit, out of the part: a fastener goes in against it. */
    normal: Vec3;
    radius: number;
}

interface AssemblyHole {
    occurrencePath: string[];
    origin: Vec3;
    /** Unit. */
    direction: Vec3;
    radius: number;
    /** Along `direction` from `origin`. */
    start: number;
    end: number;
    closedAtStart: boolean;
    closedAtEnd: boolean;
    threaded: boolean;
    majorDiameter?: number;
    edges: { id: string; at: number }[];
}

interface PlacedScrew {
    origin: Vec3;
    axis: Vec3;
}

interface HolePlan {
    planned: PlannedHole;
    circularEdge: AssemblyCircularEdge;
    /** Where the nut seats, out the far side, and the edge it's fastened to. */
    exit?: { point: Vec3; edge: MateEdge; radius: number };
}

interface CatalogLength {
    id: string;
    name: string;
    length: number;
    /** Whether it's sold fully threaded as well as partly, so the studio asks which. */
    fullThreadChoice: boolean;
}

enum FastenerKind {
    SCREW = "screw",
    WASHER = "washer",
    NUT = "nut"
}

interface MateEdge {
    occurrencePath: string[];
    edgeId: string;
}

interface FastenerSet {
    catalog: Catalog;
    studios: Record<FastenerKind, FastenerStudio>;
}

interface Catalog {
    vendors: CatalogVendor[];
    sizes: CatalogSize[];
    heads: CatalogHead[];
    screws: CatalogScrew[];
    nutTypes: { id: string; name: string }[];
    nuts: CatalogNut[];
    washers: CatalogWasher[];
}

interface FastenerStudio {
    parameters: ConfigurationParameter[];
    location: StudioLocation;
    /** What a fasten mate names its mate connector by, as the studio's load found it. */
    mateConnectorId?: string;
}

interface CatalogVendor {
    id: string;
    name: string;
}

interface CatalogSize {
    id: string;
    name: string;
    majorDiameter: number;
    pitch: number;
    tapDrillDiameter: number;
    closeClearanceDiameter: number;
    freeClearanceDiameter: number;
}

interface CatalogHead {
    id: string;
    name: string;
    sizes: Record<
        string,
        { diameter: number; height: number; countersunk: boolean }
    >;
}

interface CatalogScrew {
    vendor: string;
    size: string;
    head: string;
    finish: string;
    lengths: CatalogLength[];
}

interface CatalogNut extends Stocked {
    vendor: string;
    size: string;
    type: string;
    acrossFlats: number;
    height: number;
}

interface CatalogWasher {
    vendor: string;
    size: string;
    type: string;
    name: string;
    innerDiameter: number;
    outerDiameter: number;
    thickness: number;
    /** The finishes it's made in, which don't change its size. */
    finishes: string[];
}

interface Stocked {
    partNumber?: string;
    url?: string;
}
```

`src/backend/features/quick-fastener/insert.ts`

```ts
// Each ready hole's parts, in two stacks, each part on the one under it.
function placements(set: FastenerSet, plans: HolePlan[]): PartPlacement[];
// Alike holes together, each group's first the one given parts.
function replicateGroups(plans: HolePlan[]): HolePlan[][];
function insertGroups(
    set: FastenerSet,
    parts: PartPlacement[]
): { instances: object[]; transform: number[] }[];
async function washerTopEdges(
    client: OnshapeApi,
    kv: KVNamespace,
    set: FastenerSet,
    parts: PartPlacement[]
): Promise<Record<number, string>>;
function partMate(
    part: PartPlacement,
    path: string[],
    connectorId: string,
    paths: (string[] | undefined)[],
    washerEdges: Record<number, string>
): object | undefined;
// The screw stack goes on the rest's circular edges; the nut stack, their far edges.
function stackTargets(group: HolePlan[], stack: PartStack): EdgeReference[];

interface PartPlacement {
    kind: FastenerKind;
    /** The hole it's in, by its plan's key. */
    hole: string;
    stack: PartStack;
    /** The studio's overrides of its defaults. */
    configuration: Selection;
    transform: number[];
    seat: PartSeat;
    name: string;
}

enum PartStack {
    /** The screw and the washer under its head, on the hole's circular edge. */
    SCREW = "screw",
    /** The nut and its washer, on the far side's edge. */
    NUT = "nut"
}

type PartSeat = { edge: MateEdge } | { washer: number };
```

`src/backend/features/quick-fastener/replicate.ts` and
`src/backend/lib/onshape/objects/assembly-features.ts`, shared with insert and
fasten

```ts
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

type EdgeReference = EntityReference;

interface EntityReference {
    /** The id Onshape's selection reports, which is the entity's deterministic id. */
    deterministicId: string;
    path: string[];
}

interface ReplicateArgs {
    name: string;
    /** The seed's instances, each copied onto every match. */
    instancePaths: string[][];
    /** The mate placing the seed, which each copy is placed as. */
    mateFeatureId: string;
    /** Each the size of the seed mate's edge. */
    edges: EdgeReference[];
}
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
function describePlan(
    set: FastenerSet | undefined,
    planned: PlannedHole
): string;
function LastRunCallout(props: LastRunCalloutProps): ReactNode;
function JobDetails(props: JobDetailsProps): ReactNode;
// A toast when a run finishes, from anywhere in the app.
function useFastenerJobToasts(): void;

interface LastRunCalloutProps {
    assembly: ElementPath;
}

interface JobDetailsProps {
    assembly: ElementPath;
}
```

`src/frontend/routes/app/quick-fastener.tsx` is the route, with a notice
outside an assembly. `src/backend/features/quick-fastener/geometry.ts` holds
vectors, Onshape's 4×4 transforms and `LINEAR_TOLERANCE`.

## Storage

- **D1** `generated_sets` (`fasteners` in FRCDesignLib) and the Fasteners
  group's insertables — the catalog and each kind's studio (its parameters and
  where it's released), as the group's last load stored them; read, never
  written, here (see [generated-parts.md](./generated-parts.md)).
- **KV** `quick-fastener-scan:{key}` — a Part Studio's holes, by part id, for a
  month. The key is what pins the Part Studio's geometry and its configuration
  (`toStudioSource`): `{documentId}|v|{versionId}|…` for a part from a version,
  `{documentId}|e|{elementMicroversionId}|…` for one from the assembly's own
  workspace, and `{documentId}|m|{documentMicroversionId}|…` otherwise.
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

1. Once the app sends `applicationInit`, Onshape sends the window's whole
   selection each time it changes: in a `SELECTION` message, or, while a
   request is pending, in its answers instead (`REQUESTED_SELECTION`, and
   `REQUESTED_SELECTION_HIGHLIGHT` when one carries `selections`).
   `parseSelections` keeps its entities, and `receive` hands the focused list
   what was added and what was removed since the last. A
   highlight or a selection request changes the window's selection too, and
   Onshape reports that as an empty selection, then the new one, sometimes
   interleaved with an earlier highlight's; so the app says what it expects
   (`expectSelection`, `expectCleared`) and takes nothing until that arrives,
   or for a second at most. None of this is documented, so every message to
   and from Onshape is logged at debug level ("Sent to Onshape", "Received from
   Onshape"), and `window.sendToOnshape(message)` sends one by hand from the
   browser console, addressed to the launching element.
2. Clicking a `QueryList` focuses it (one at a time, `useOnshapeSelection`) and
   shows its prompt in Onshape's bubble. The focused list adds what's picked of
   the kind it takes, drops what's deselected, and repeats its prompt for
   anything else picked. With no list focused, the selection is ignored. A list
   is named inside its box, as Onshape's query parameters are.
3. While focused, a list holds a `requestSelection` with its `filter`
   (`sendSelectionRequest`), which limits what the Onshape window lets be
   picked: `CIRCULAR_EDGES` (`entityTypeSpecifier: ["EDGE"]`,
   `selectionTypeSpecifier: ["GEOMETRY"]`, `geometryTypeSpecifier: ["CIRCLE"]`)
   or `PLANAR_FACES` (`["FACE"]`, `["GEOMETRY"]`, `["PLANE"]`). Onshape
   documents other field names, which it ignores. The request clears the
   window's selection, and Onshape shows what's picked under it, so nothing is
   sent as picks arrive. **Clear** empties the list and asks for the filter
   again, clearing the window too. Losing focus or unmounting sends
   `stopRequest`. Every stop names the request it ends by its `messageId`,
   which Onshape answers as `stoppedRequestId`.
4. Hovering a row, in any list, lights its entity up alone
   (`requestSelectionHighlight`, which makes it what the Onshape window shows
   selected, each with its own message id). Moving between rows lights each
   alone; leaving the rows sends `stopRequest` with the highlight's
   `messageId` to end it, then sends the focused list's `requestSelection`
   again under its original `messageId` (`resumeFocused`), so picks are
   limited again. That request's clearing of the window isn't taken as picks
   (`expectCleared`). Removing a row lights the rest up. Clicking a focused
   list asks for its filter again.

### The form

The panel first reads the fasteners the library loaded (`useFastenerSetQuery`,
`GET /api/quick-fastener/parts`). Until FRCDesignLib's Fasteners group has
loaded them it says so, and offers nothing to insert.

The panel is a `ParameterGrid` of the configuration dialog's own inputs
(`ParameterInput`), in groups under plain headings (`ParameterGroup`):

1. **Fastener**: Program, then the screw studio's Vendor, Size, Head and
   Finish, then _Sizing_ in place of its Length: **Automatic** (the default)
   picks a length for each hole, and **Manual** shows the studio's Length, and,
   beside a length sold both ways, its Fully threaded.
2. **Add screw washer**, **Add nut** and **Add nut washer**, each a group its
   checkbox shows: the washer or nut studio's parameters but its Size, which is
   the screw's. A washer's Vendor offers those making it in that size, and is
   left out under a Generic screw, whose washers are Generic; a nut has none,
   since one vendor makes them all. Like every studio input, a washer's Type and
   Finish show only where there's a choice, so a Generic washer, one in each
   size, shows its checkbox alone. The screw washer is gone under a countersunk
   head, and the nut washer without a nut.
3. Automatic only: _Stop condition_ (**Max length** with its length, or **First
   gap** with the widest gap to ignore), and _Max thread depth_.
4. **Selections**, last: _Select by_ (Circular edges, the default, or Faces),
   and its query lists.

The studios' parameters are their configurations as Onshape answers them,
parsed by `parseOnshapeConfiguration`, so their options show as the Part
Studios show them. A studio shows an input only where it offers more than one
option, and leaves out one with a single option anywhere (the nut's Vendor).
What's stored is settled on every read (`settleChoices`): each studio's
selection through `normalizeSelection`, then each hidden or left-out input set
to the one value made there, from the catalog, as the feature resolves it
(`settle` in `studios.ts`); and each part into the screw's size from a vendor
making it (`settlePart`: the one chosen, else the screw's, else Generic, else
the first making it). Changing the screw's vendor moves every part to it, where
it makes them.

### Picking what to fasten

_Select by_ decides what the picks are:

- **Circular edges** — each picked circular edge is a hole to fasten; nothing
  is skipped.
- **Faces** — every circular edge of each planar face is a hole to fasten;
  _Holes to skip_ takes the edges of holes in them to leave out.

`insertBody` in `routes.ts` refuses a body whose picks don't match its mode,
and a part its studio doesn't make (`isMade`) or not in the screw's size.
Changing the mode clears the picks.

### Starting a run — `POST /api/quick-fastener/insert`

1. Answers 400 for FTC, 503 when no fasteners are loaded (`getFastenerSet`),
   400 for a part the loaded catalog doesn't make in the screw's size
   (`isMade`), and 409 while a run in the same assembly is still going
   (`getJobStatus`).
2. Creates a `QuickFastenerWorkflow` run with the caller's session id, stores
   it as `RUNNING` with every step pending, pushes, and answers that status.
   Picks are cleared on the page; the run goes on whether or not anyone stays.

### A run — `QuickFastenerWorkflow`

Each step reports itself started (`report-{action}`), then makes its Onshape
calls, each in a Workflow step of its own. Each call is one Onshape answers at
once, so it's retried once, two seconds later (after `Retry-After` on a 429;
`ONSHAPE_STEP_RETRIES`), then fails. A read is retried when its failure is
transient (`isTransient`); a write only when Onshape refused it with 429 before
doing anything (`isRateLimited`), so a retry never inserts or mates twice. The app's own errors (`ApiError`), such as an inserted part with no mate
connector, are never retried, whatever status they carry. Each retry is logged
as a warning, and a step that fails for good is logged with Onshape's error,
recorded with why, and the steps after it are skipped.

0. Reads the loaded fasteners once (`fastener-set`), which the rest of the run
   uses even if the library reloads them meanwhile; with none, the run fails.
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
       ones. A pick that gives no circular edge is reported as a hole that
       can't be fastened, saying why (`IndexedHoles.unfound`).
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
   The ready holes are grouped first (`replicateGroups`):
   holes given the same parts, as deep, through circular edges of the same
   size and out far edges of the same size, in the order found. Only each
   group's first hole gets parts here.
3. **Fasten parts**:
    1. Takes each studio's mate connector id from its load
       (`FastenerStudio.mateConnectorId`, the insertable's fasten info); with
       one missing, the step fails.
    2. Scans the washer studio in each configuration placed, for its top edge
       (`washerTopEdge`): its hole's circular edge farthest up its Z axis
       (`washer-edges`).
    3. Adds one fasten mate per part, one at a time (`mate-{n}`): its mate
       connector to an implicit connector at the center of what it sits on
       (`fastenMateToCircularEdge`, as insert and fasten mates). A washer is
       fastened to its stack's hole edge, and the screw or nut on it to the
       washer's top edge; without a washer, the screw or nut is fastened to the
       hole edge itself.
4. **Replicate parts**, skipped when no two holes are alike: for each group of more than
   one hole, one at a time, a Replicate per stack of the first hole's parts
   (`replicate-{n}-screw`, then `replicate-{n}-nut`), each seeded with the
   stack's parts and placed as the mate holding its bottom part on its edge
   (`addReplicate`). Each matches individual edges (`stackTargets`): the
   screw stack's, the rest of the group's circular edges; the nut stack's,
   their far edges. Onshape refusing one fails the step, with Onshape's
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
| "Loading fasteners..."                                                                                                           | In place of the panel, while the fasteners are read        |
| "Couldn't load the fasteners."                                                                                                   | In place of the panel, the read failed                     |
| "No fasteners are loaded yet." / "Quick Fastener uses the fasteners in FRCDesignLib's Fasteners group, once they're loaded."     | In place of the panel, none loaded                         |
| "Selections"                                                                                                                     | Heading, last                                              |
| "Select by" / "Circular edges" / "Faces"                                                                                         | Selection mode, its options                                |
| "Faces"                                                                                                                          | Targets list's label, faces                                |
| "Select faces to fasten every hole in."                                                                                          | Targets list's prompt, faces, in Onshape's bubble and list |
| "Holes to skip"                                                                                                                  | Second list's label, faces                                 |
| "Select the edges of holes to leave out."                                                                                        | Holes to skip's prompt                                     |
| "Circular edges"                                                                                                                 | Targets list's label, circular edges                       |
| "Select the circular edges of holes to fasten."                                                                                  | Targets list's prompt, circular edges                      |
| "Clear"                                                                                                                          | A list with picks, inside its box (`QueryList`)            |
| "{Kind} {n}", e.g. "Edge 1"                                                                                                      | A list's row                                               |
| "Fastener"                                                                                                                       | Heading                                                    |
| "Program" / "FRC" / "FTC"                                                                                                        | Program, its options                                       |
| "FTC fasteners aren't available yet."                                                                                            | In place of the Fastener group's inputs, FTC               |
| "Sizing" / "Automatic" / "Manual"                                                                                                | How the screw's length is chosen, its options              |
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
| "{parts} with problems"                                                                                                          | Headline, partly                                           |
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
| "Couldn't find this part in the assembly." / "Not a circular edge." / "No circular edges in this face."                          | A pick that gave no circular edge                          |
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
| "A fastener's studio has no mate connector to fasten by. Reload its group."                                                      | Fasten step's failure                                      |
| "A hole's parts weren't all inserted and fastened, so they can't be replicated."                                                 | Replicate step's failure                                   |
| "Onshape refused the Replicate ({Onshape's message})."                                                                           | Replicate step's failure                                   |

## Invariants

- The catalog and studios are the ones FRCDesignLib last loaded from
  robot-code's released manifest; nothing here edits them, and a run reads
  them once, at its start.
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

| Failure                              | Result                                                                                                       | Recovery                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| No fasteners are loaded              | The panel says so; insert answers 503                                                                        | Release them in robot-code, load the Fasteners group  |
| The hole scan fails in a Part Studio | Index fails, naming Onshape's notice; the rest is skipped                                                    | Fix the Part Studio, or skip what's in it             |
| No hole, or nothing fits             | That hole's plan is **no fit**, with why                                                                     | Change the options or the hole                        |
| The insert fails                     | Nothing is inserted; fastening is skipped                                                                    | Run it again                                          |
| A mate fails partway                 | The parts so far stay, some unmated                                                                          | Mate the rest by hand, or undo and run again          |
| Onshape refuses a Replicate          | Replicate fails, saying why; the holes it and those after it were for stay empty, or hold only a screw stack | Fasten the rest by hand, and report Onshape's message |
| A Replicate fails to regenerate      | It stays in the assembly, with its error                                                                     | Fix or delete it in Onshape                           |
| Onshape rate-limits                  | The step retries, then fails as above                                                                        | Run it again                                          |
| The run dies without reporting       | The job reads failed once the run has ended                                                                  | Run it again                                          |

## Decisions

- **The fasteners come from the loaded library.** robot-code holds the
  FeatureScript and its tooling, and releases a manifest beside the Part
  Studios; the library's load stores its catalog with the studios, so what
  Quick fastener offers is what FRCDesignLib has loaded, and a release reaches
  it without a deploy.
- **The hole scan lives in the app.** The app evaluates it and parses its
  answer, so the FeatureScript sits beside its parser (`hole-scan.fs`, imported
  as text), and a change to either is one commit, reviewed and deployed
  together.
- **Immutable keys, no webhooks.** A version, a document microversion and a
  tab's microversion each name geometry that can't change, so a scan keyed by
  one is cached for good, and the assembly's own reading says which key is
  current. A Part Studio deriving from another tab of its workspace keeps its
  tab's microversion when only that other tab changes; this is untried in
  Onshape.
- **The panel follows the window's selection.** Onshape reports the whole
  selection each time it changes once the app has sent `applicationInit`, so a
  focused list takes what was added and drops what was deselected, and ignores
  what its own highlights and requests made the window select. A focused list
  also holds a `requestSelection`, which only limits what the Onshape window
  lets be picked, in the form Onshape answers to (array specifiers per level)
  rather than the one it documents. A highlight replaces what the window shows
  selected, and a request clears it, so a hover ends its highlight with a stop
  naming it, then starts the focused list's request again under its own id. A highlight carrying the filter, in
  Onshape's documented fields for a selection, was tried and doesn't limit
  picks. A list still refuses kinds it doesn't take.
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
  someone using one vendor's screws may buy another's washers. Under a Generic
  screw the washers are Generic, and their Vendor isn't asked.
- **A hidden input is resolved from the catalog.** Onshape keeps a hidden input
  at whatever it last held, and `normalizeSelection` sets it to its default,
  which the vendor may not make; the feature takes the one value made there, and
  so does `settle`. Inserts send only the inputs shown (`onshapeOverrides`).
- **Alike holes are always replicated, with no option.** One set of parts and
  a Replicate per stack does what a set per hole would, in fewer inserts and
  mates. Onshape publishes no spec for Replicate: `replicateFeature` is copied
  from a Replicate matching edges on a face, with the individual edges' scope,
  which is unconfirmed, so a refused Replicate fails the run's last step with
  Onshape's message. Every Replicate matches individual edges, never a face, as
  insert and fasten's do, and shares its Replicate and mate code, so one fix
  there fixes both.
- **No fallbacks.** Onshape refusing a write fails its step with Onshape's
  message rather than being worked around.
- **An automatic screw is partly threaded.** The screw studio asks Fully
  threaded only of a length, so automatic sizing has nothing to ask it of; its
  finish, chosen before the length, it keeps.
- **Sizing is its own input.** Automatic and Manual are a choice of their own
  beside the screw's Length, so switching back is in sight whatever length is
  chosen.
- **The size is chosen, even in automatic mode.** A clearance hole fits more
  than one size, and a hole at 0.201" is both #10's clearance and 1/4-20's tap
  drill; the person knows which they meant. Automatic picks the length.
- **Every scan is sent the picked ids, not a `queries` body.** The lambda is
  wrapped to build its queries from `qTransient`, whose form std documents.

_Last reviewed: 2026-10-22_
