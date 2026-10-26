# Insert and fasten

## Purpose

Inserting a part into an assembly can also mate it in place: a fasten mate from
the part's own mate connector either to nothing yet, for the user to finish in
the mate dialog, or to circular edges picked in the Onshape window. The picks
are circular edges, or faces whose every hole is fastened to, less holes to
skip; they work the way Quick fastener's do, and share its selection store,
query list and hole scan ([quick-fastener.md](./quick-fastener.md)). Part
studios derive instead and are not fastened.

## Code map

Where to start reading, in the order a fasten runs.

`src/frontend/lib/selection.ts` and `src/frontend/components/query-list.tsx`,
shared with Quick fastener

```ts
// The one focused list, and handing it how the window's selection changed.
const useOnshapeSelection: UseBoundStore<StoreApi<SelectionState>>;
function toSelectedEntities(selections: OnshapeSelection[]): SelectedEntity[];
function QueryList(props: QueryListProps): ReactNode;

interface SelectionState {
    /** The query list taking picks; none takes them when absent. */
    focused?: string;
    /** Takes a SELECTION message's whole selection. */
    receive: (selection: OnshapeSelection[]) => void;
    focus: (listId: string | undefined) => void;
}

interface OnshapeSelection {
    entityType: string;
    /** Its deterministic id in the Part Studio it's from. */
    selectionId: string;
    /** The part occurrence it's on, from the assembly down. */
    occurrencePath: string[];
}

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

`src/frontend/features/insert/fasten-picks.ts`

```ts
const useFastenPicks: UseBoundStore<StoreApi<FastenPicksState>>;
// Focuses the targets' list while the menu is open.
function useFastenPicksFromSelection(mode: SelectionMode): void;
function clearFastenPicks(): void;

interface FastenPicksState {
    targets: OnshapeSelection[];
    /** Edges of holes in the faces to leave out; faces only. */
    excluded: OnshapeSelection[];
}
```

`src/frontend/features/insert/components/fasten-circular-edges-status.tsx`,
`src/frontend/features/insert/queries.ts` and
`src/frontend/features/insert/insert-tips.ts`

```ts
// The icon, its card, the mode, the query lists and the Replicate checkbox.
function FastenCircularEdgesStatus(
    props: FastenCircularEdgesStatusProps
): ReactNode;
// Sends the picks and the Replicate preference with a fasten.
function useInsertMutation(
    insertable: InsertableOut,
    selection: PartialSelection | undefined,
    insertArgs: InsertArgs
);
function useFastenCircularEdgesTip(): (fasten: boolean) => void;

interface FastenCircularEdgesStatusProps {
    /** Whether an editor allowed the part to replicate. */
    supportsReplicate: boolean;
}

interface InsertArgs {
    /** Whether the part is favorited — see `source` for where the insert began. */
    isFavorite: boolean;
    source: InsertSource;
    isQuickInsert?: boolean;
}
```

`src/backend/features/library/insertables/routes.ts`

```text
POST /api/add-to-assembly/insertable/:insertableId    inserts, then fastens
POST /api/toggle-replicate/library/:libraryId/insertable/:insertableId
```

`src/backend/features/quick-fastener/picked.ts`,
`src/backend/features/quick-fastener/index-holes.ts`,
`src/backend/features/quick-fastener/contract.ts` and
`src/backend/features/quick-fastener/planner.ts`, shared with Quick fastener

```ts
const entitySchema: ZodObject<...>;
function isConsistentPick(body: PickedEntities): boolean;
// The picked circular edges, in the assembly, with their radii.
async function indexHoles(
    client: OnshapeApi,
    kv: KVNamespace,
    assembly: ElementPath,
    targets: SelectedEntity[],
    excluded: SelectedEntity[],
    // The loaded fasteners, which have no holes to fasten through
    fasteners: FastenerSet | undefined
): Promise<IndexedHoles>;

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

enum SelectionMode {
    FACES = "faces",
    LOCATIONS = "locations"
}

interface PickedEntities {
    selectionMode: SelectionMode;
    targets: z.infer<typeof entitySchema>[];
    excluded: z.infer<typeof entitySchema>[];
}

interface IndexedHoles {
    circularEdges: AssemblyCircularEdge[];
    holes: AssemblyHole[];
    placed: PlacedScrew[];
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
```

`src/backend/features/library/insertables/fasten-circular-edges.ts`

```ts
// One instance per edge, or per edge size with a Replicate onto the rest.
async function fastenToCircularEdges(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    args: FastenToCircularEdgesArgs
): Promise<void>;
function groupBySize(edges: AssemblyCircularEdge[]): AssemblyCircularEdge[][];

interface FastenToCircularEdgesArgs {
    /** The part's, which its mates and Replicates are named. */
    name: string;
    /** The instance already inserted, which takes the first edge. */
    inserted: OnshapeInsertInstancesResponse;
    /** Inserts one more instance, for an edge no Replicate covers. */
    insert: () => Promise<OnshapeInsertInstancesResponse>;
    /** The inserted part's own connector, in the instance at `instancePath`. */
    fastenQuery: (instancePath: string[]) => object;
    /** From `indexHoles`, in the order picked. */
    edges: AssemblyCircularEdge[];
    replicate: boolean;
}
```

`src/backend/features/quick-fastener/replicate.ts`, shared with Quick fastener

```ts
// Onshape refusing it is an error in the user's words; Onshape's own is logged.
async function addReplicate(
    onshapeApi: OnshapeApi,
    assembly: ElementPath,
    args: ReplicateArgs
): Promise<void>;

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

`src/backend/lib/onshape/objects/assembly-features.ts`, shared with Quick
fastener, and `src/backend/features/library/insertables/fasten-query.ts`

```ts
// Every fasten mate to a circular edge, Quick fastener's included.
function fastenMateToCircularEdge(
    name: string,
    query: object,
    edge: EdgeReference
): object;
// Onshape's "Match individual edges".
function replicateFeature(
    name: string,
    instancePaths: string[][],
    mateFeatureId: string,
    edges: EdgeReference[]
): object;
// The inserted part's own connector, as a query on its instance.
function getFastenQuery(
    targetElementType: ElementType,
    path: string[],
    fastenInfo: FastenInfo
): object;

type EdgeReference = EntityReference;

interface EntityReference {
    /** The id Onshape's selection reports, which is the entity's deterministic id. */
    deterministicId: string;
    path: string[];
}
```

`src/backend/features/load/parse-fasten.ts`,
`src/backend/features/library/insertables/fasten.ts` and
`src/backend/features/build-checker/checks.ts`

```ts
// Finds the mate connector an insertable fastens by, at load or toggle: the
// first unsuppressed feature that makes one, Onshape's, named by its feature
// id, or a generated studio's, named `<featureId>.<mateConnector>`.
async function parseFastenInfo(
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    // Every loaded set's studio features (`generatedFeatures`)
    generatedFeatures: GeneratedFeature[]
): Promise<FastenInfo>;
// The Replicate not decided warning.
function checkInsertableSettings(input: InsertableSettingsInput): BuildIssue[];

interface FastenInfo {
    mateConnectorId: string;
    mateLocation: MateLocation;
    path: string[];
}

// A generated studio's feature type, and the id it gives its mate connector.
interface GeneratedFeature {
    type: string;
    mateConnector?: string;
}

enum MateLocation {
    Feature = "Feature",
    Part = "Part",
    Subassembly = "Subassembly"
}

interface InsertableSettingsInput {
    supportsFasten: boolean;
    /** Undefined until an editor decides. */
    supportsReplicate?: boolean;
}
```

## Storage

- **D1** `insertables.supports_fasten` and `fasten_info` (`FastenInfo`): set
  by a load or the toggle, cleared when fasten is turned off. A new row is off,
  except a generated tab's, which is on (see
  [generated-parts.md](./generated-parts.md)).
- **D1** `insertables.supports_replicate`: whether an editor allows the part to
  replicate; null until one decides. Reloads keep it.
- **KV** `quick-fastener-scan:` — each Part Studio's scan, shared with Quick
  fastener, which owns it.
- **KV** `seen-hints:` — `Hint.FASTENED_TO_CIRCULAR_EDGES`, once the user has
  fastened to circular edges; see [auth.md](./auth.md).
- **Memory** `useFastenPicks` — the targets and holes to skip, for the tab.
- **localStorage** (`ui-state`): `fasten`, `fastenSelectionMode`, `replicate`
  and `fastenCircularEdgesTipCount`.

## Flows

### Picking

1. Once the app sends `applicationInit`, Onshape sends the window's whole
   selection each time it changes, and `useOnshapeSelection` hands the focused
   `QueryList` what was added and deselected, as in Quick fastener.
2. With **Fasten** ticked in an assembly, the insert menu shows the cursor icon
   beside the insert location's: a red stop sign with nothing picked, a check
   with something. `useFastenPicksFromSelection` focuses the targets' list, so
   anything picked while the menu is open joins it; what was picked before it
   opened isn't known.
3. The card holds the mode (**Circular edges** or planar **Faces**), the targets'
   query list, and in faces mode **Holes to skip**. It stays mounted while
   hidden (`keepMounted`), so its lists take picks with the card closed, and
   the icon turns the primary colour while one of them is focused. A focused
   list limits what the Onshape window lets be picked to its kind, as in Quick
   fastener. Hovering a row lights its entity up; clicking a list shows its
   prompt in Onshape.
4. Changing the mode clears the picks.

### Inserting

1. `useInsertMutation` reads the picks, the mode and the Replicate preference
   at the click, and sends them with `fasten` to `POST /add-to-assembly`.
   `isConsistentPick` refuses edges as faces, or faces as edges.
2. With picks, the route calls `indexHoles` first, which scans each Part Studio
   holding a pick (cached) and answers the picked circular edges in the
   assembly with their radii: each picked edge that is circular, or every
   circular edge of each picked face, less the skipped holes. None found
   answers 400 and inserts nothing.
3. It inserts the part at the insert location, then names its mates and
   Replicates after the part: its configuration's indexed record's name, the
   element's own part's at the defaults, else the tab's (`partName`,
   `readStoredParts`):
    - **No picks**: adds a fasten mate naming only the part's connector, and
      answers its `featureId`; the client opens the mate dialog to finish it.
    - **One instance each**: `fastenToCircularEdges` mates the inserted
      instance to the first edge, then inserts and mates one more per remaining
      edge, serially. Each mate is the part's connector followed by an implicit
      connector the mate owns, at the edge's centre, so the edge's part stays
      put.
    - **Replicated**: with Replicate and a part allowed it, `groupBySize`
      groups the edges by radius in the order found. Each group gets one
      instance, the inserted one first, mated to its first edge, and a
      Replicate onto the rest of the group's edges, each matched on its own
      (`addReplicate`), whether they were picked or came from a face.

    Either way it answers `fastenedCount` and records
    `Hint.FASTENED_TO_CIRCULAR_EDGES`.

4. On `fastenedCount` the client clears the picks.
5. An insert and fasten with nothing picked shows the circular edges tip,
   unless the quick insert tip showed, at most three times and never after the
   hint is seen.

### Deciding whether a part replicates

1. A part with Insert and fasten on and `supports_replicate` null shows the
   **Replicate not decided** warning. `GET /api/build-status` adds it from
   `checkInsertableSettings` as it answers, so no load records it.
2. The Replicate switch under the part's admin toggles shows the undecided
   state with its thumb centred. Either choice, through
   `POST /api/toggle-replicate`, clears the warning and bumps the library
   version, since `InsertableOut.supportsReplicate` changes.

## User-facing strings

| String                                                                                                                       | Where                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| "{n} circular edges selected" / "{n} faces selected"                                                                         | Card title, with picks                                  |
| "No circular edges selected" / "No faces selected"                                                                           | Card title, without                                     |
| "New"                                                                                                                        | Badge beside the title until the hint is seen           |
| "Select edges to automatically fasten this part to."                                                                         | Card description, circular edges, none picked           |
| "The part will be fastened to the selected edge."                                                                            | Card description, one edge                              |
| "A part will be inserted and fastened to each selected edge."                                                                | Card description, several edges                         |
| "A part will be fastened to an edge and replicated onto the rest."                                                           | Card description, several edges, Replicate              |
| "Select faces to automatically fasten this part to every hole in them."                                                      | Card description, faces, none picked                    |
| "A part will be inserted and fastened to every hole in the selected faces."                                                  | Card description, faces                                 |
| "A part will be fastened to a hole and replicated onto every other hole in the selected faces."                              | Card description, faces, Replicate                      |
| "Circular edges" / "Faces"                                                                                                   | Mode, and the targets list's label                      |
| "Holes to skip"                                                                                                              | Second list's label, faces                              |
| "Select circular edges to fasten this part to."                                                                              | Targets list's prompt, in Onshape's bubble and the list |
| "Select faces to fasten this part to every hole in."                                                                         | Targets list's prompt, faces                            |
| "Select the edges of holes to leave out."                                                                                    | Holes to skip's prompt                                  |
| "Clear"                                                                                                                      | A list with picks, inside its box (`QueryList`)         |
| "Replicate"                                                                                                                  | Checkbox                                                |
| "Insert one part and replicate it onto the other holes, rather than inserting a part for each."                              | Replicate's info tooltip                                |
| "Successfully inserted {name} and fastened it to {n} circular edges."                                                        | Success toast, with picks                               |
| "Successfully inserted {name} and created a Fasten mate."                                                                    | Success toast, without                                  |
| "No circular edges were found in what was selected."                                                                         | Error toast, picks with no circular edge                |
| "Select either faces or circular edges to fasten to, not both."                                                              | Validation error, inconsistent picks                    |
| "{name} does not support insert and fasten."                                                                                 | Error toast                                             |
| "Tip: You can select circular edges in Onshape before you insert and fasten to automatically fasten to each one."            | Tip toast                                               |
| "Onshape refused the Replicate."                                                                                             | Error toast                                             |
| "Replicate not decided"                                                                                                      | Build check title                                       |
| "Allow replicate for parts that sit the same way on every circular edge, like bolts, and not for parts with an orientation." | Build check description                                 |
| "Replicate"                                                                                                                  | Editor switch label                                     |
| "Undecided: allow for parts that sit the same way on every edge" / "Allows replicating onto several circular edges"          | Editor switch description, undecided / decided          |

## Invariants

- The insert is recorded exactly once per request, with `fasten` true only once
  every mate and the Replicate are built.
- Picks are read before anything is inserted, so picks with no circular edge
  insert nothing.
- Nothing replicates unless `supports_replicate` is true: the client hides the
  option, and the route ignores `replicate` for any other part.
- Every edge a Replicate targets has the radius of its seed's edge, within
  Onshape's length tolerance (`sameRadius`); Onshape matches no other.
- A Replicate matches individual edges, never a face or a plane.
- Mates and inserts are added one at a time: Onshape rejects a feature-list edit
  that races another.

## Failure and recovery

- **A mate fails**: the request errors, and whatever was inserted before it
  stays in the assembly, as in the Onshape UI.
- **Onshape refuses a Replicate**: the request errors with Onshape's own
  message, and the instance and mate before it stay in the assembly, as for
  a mate. One Onshape accepts but fails to regenerate stays in the assembly
  for the user to fix.
- **The scan fails in a Part Studio**: the request errors and nothing is
  inserted; see [quick-fastener.md](./quick-fastener.md).
- **A pick isn't circular**: the scan finds no circular edge for it and it is left
  out; with nothing left, the request answers 400.

## Decisions

- **One way to pick, shared with Quick fastener.** The app follows the
  selection Onshape reports and lets a focused query list take it. A focused list
  also holds a `requestSelection` limiting the Onshape window to its kind, in
  the form Onshape answers to rather than the one it documents (see Quick
  fastener's picking flow); a hovered row lights its own entity up alone, and
  leaving it ends that highlight with a stop and starts the focused list's
  request again. The list still refuses other
  kinds, and the scan drops edges that
  aren't circular.
- **The list stays focused.** The targets' list is focused while the menu is
  open, so picking in Onshape and then inserting needs no click in the panel.
  A list takes what's added to the selection after it's focused, so what was
  picked before the menu opened isn't taken.
- **Replicate is copied from Onshape.** Onshape's feature specs omit
  Replicate, so `replicateFeature` is shaped as Onshape answers a Replicate of
  picked edges: the `SAME_EDGE` scope, with the edges in `targetEdges`.
  Replicate is off by default for a part modeled by hand.
- **No fallbacks.** Onshape refusing a Replicate, or any other write, is an
  error the user sees, not something worked around with other features.
- **Individual edges only.** Of Onshape's three ways to match, only "Match
  individual edges" is used, even for a picked face whose every hole is in the
  group. One way to build a Replicate is simpler to get right than three; a
  face's Replicate would follow holes added later, which this gives up.
- **Always a new Replicate.** An insert never edits a Replicate already in the
  assembly; adding edges to an existing one is the user's to do in Onshape.
- **Radii from the scan.** Onshape's selection messages carry no geometry, so
  the circular edges and their radii come from Quick fastener's hole scan, which also
  turns a face into its holes.
- **Replicate is the editor's call.** Insert and fasten suits any part with a
  mate connector, including ones whose orientation matters, which a Replicate
  can place wrongly. Existing parts were never assessed, so null means
  undecided and raises a warning rather than defaulting either way.
- **Implicit connector ids.** A mate names its implicit connector by a
  placeholder id that Onshape replaces on creation, which is undocumented but
  is how Onshape itself stores a mate to an inferred point. It's unconfirmed
  in Onshape; insert and fasten and Quick fastener both build their mates with
  `fastenMateToCircularEdge`, so they work or fail together.

_Last reviewed: 2026-10-21_
