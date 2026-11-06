# Insert and fasten

## Purpose

Inserting a part into an assembly can also mate it in place: a fasten mate from
the part's own mate connector either to nothing yet, for the user to finish in
the mate dialog, or to circular edges picked in the Onshape window, with an
instance of the part on each. The picks are circular edges, or faces whose every
hole is fastened to, less holes to skip; they can be made from the navbar before
a quick insert or in the insert menu, and work the way Auto Assembly's do,
sharing its selection store, query list and hole scan
([auto-assembly.md](./auto-assembly.md)). Part studios derive instead and are
not fastened.

## Code map

Where to start reading, in the order a fasten runs.

`src/frontend/lib/selection.ts` and `src/frontend/components/query-list.tsx`,
shared with Auto Assembly

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
    /** Takes picks whenever no list does, as a form's first list should. */
    autoFocus?: boolean;
    /** Why a row won't do what it was picked for; shown under it, in red. */
    problem?: (entity: OnshapeSelection) => string | undefined;
}
```

`src/frontend/features/insert/fasten-picks.ts`

```ts
// Held for the tab, so picks carry from the navbar into the insert menu.
const useFastenPicks: UseBoundStore<StoreApi<FastenPicksState>>;
// Clears picks of the other kind when the mode changes.
function useFastenPicksForMode(mode: SelectionMode): void;
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
// The icon, its card, the mode and the query lists, in the insert menu.
function FastenCircularEdgesStatus(): ReactNode;
// The same in the navbar, for an assembly, signed in, while no insert menu is open.
function NavbarFastenStatus(): ReactNode;
// Sends the picks with a fasten, a quick insert's included.
function useInsertMutation(
    insertable: InsertableOut,
    selection: PartialSelection | undefined,
    insertArgs: InsertArgs
);
function useFastenCircularEdgesTip(): (fasten: boolean) => void;

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
```

`src/backend/features/auto-assembly/picked.ts`,
`src/backend/features/auto-assembly/index-holes.ts`,
`src/backend/features/auto-assembly/contract.ts` and
`src/backend/features/auto-assembly/planner.ts`, shared with Auto Assembly

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
// An instance fastened to each edge.
async function fastenToCircularEdges(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    args: FastenToCircularEdgesArgs
): Promise<void>;

interface FastenToCircularEdgesArgs {
    /** The part's, which its mates are named. */
    name: string;
    /** The instance already inserted, which takes the first edge. */
    inserted: OnshapeInsertInstancesResponse;
    /** Inserts one more instance, for each edge after the first. */
    insert: () => Promise<OnshapeInsertInstancesResponse>;
    /** The inserted part's own connector, in the instance at `instancePath`. */
    fastenQuery: (instancePath: string[]) => object;
    /** From `indexHoles`, in the order picked. */
    edges: AssemblyCircularEdge[];
}
```

`src/backend/lib/onshape/objects/assembly-features.ts`, shared with Quick
fastener, and `src/backend/features/library/insertables/fasten-query.ts`

```ts
// Every fasten mate to a circular edge, Auto Assembly's included.
function fastenMateToCircularEdge(
    name: string,
    query: object,
    edge: EdgeReference
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

`src/backend/features/load/parse-fasten.ts` and
`src/backend/features/library/insertables/fasten.ts`

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
```

## Storage

- **D1** `insertables.supports_fasten` and `fasten_info` (`FastenInfo`): set
  by a load or the toggle, cleared when fasten is turned off. A new row is off,
  except a generated tab's, which is on (see
  [generated-parts.md](./generated-parts.md)).
- **KV** `auto-assembly-scan:` — each Part Studio's scan, shared with Quick
  fastener, which owns it.
- **KV** `seen-hints:` — `Hint.FASTENED_TO_CIRCULAR_EDGES`, once the user has
  fastened to circular edges; see [auth.md](./auth.md).
- **Memory** `useFastenPicks` — the targets and holes to skip, for the tab,
  shared by the navbar and the insert menu.
- **localStorage** (`ui-state`): `fasten`, `fastenSelectionMode` and
  `fastenCircularEdgesTipCount`.

## Flows

### Picking

1. Once the app sends `applicationInit`, Onshape sends the window's whole
   selection each time it changes, and `useOnshapeSelection` hands the focused
   `QueryList` what was added and deselected, as in Auto Assembly.
2. In an assembly, signed in, the navbar of a library page shows the cursor
   icon beside the insert location's (`NavbarFastenStatus`): a red stop sign
   with nothing picked, a check with something. So does the insert menu, with
   **Fasten** ticked (`FastenCircularEdgesStatus`). The navbar hides its own
   while an insert menu is open (`openInsertableId`), since two lists of one id
   would both take picks; both read `useFastenPicks`, so what was picked from
   the navbar is in the menu's list, and the other way round.
3. The card holds the mode (**Circular edges** or planar **Faces**), the targets'
   query list, and in faces mode **Holes to skip**. It stays mounted while
   hidden (`keepMounted`), so its lists take picks with the card closed, and
   the icon turns the primary colour while one of them is focused. The targets'
   list is `autoFocus`: it is focused on mount, and again whenever the focused
   list unmounts, so one list always takes picks. A focused list limits what
   the Onshape window lets be picked to its kind, as in Auto Assembly.
   Hovering a row lights its entity up; clicking a list shows its prompt in
   Onshape.
4. Changing the mode clears the picks.
5. A moment after the picks change, they're checked in the background with
   Auto Assembly's `POST /api/auto-assembly/check`, without options: a pick
   that gives no circular edge, or a hole to skip outside the faces picked,
   turns red with why under it. See
   [auto-assembly.md](./auto-assembly.md#checking-picks--post-apiauto-assemblycheck).

### Inserting

1. `useInsertMutation` reads the picks and the mode at the click, and sends
   them with `fasten` to `POST /add-to-assembly`, from the insert menu's
   **Insert** or a row's **Quick insert and fasten** alike.
   `isConsistentPick` refuses edges as faces, or faces as edges.
2. With picks, the route calls `indexHoles` first, which scans each Part Studio
   holding a pick (cached) and answers the picked circular edges in the
   assembly with their radii: each picked edge that is circular, or every
   circular edge of each picked face, less the skipped holes. None found
   answers 400 and inserts nothing.
3. It inserts the part at the insert location, then names its mates after the
   part: its configuration's indexed record's name, the element's own part's at
   the defaults, else the tab's (`partName`, `readStoredParts`):
    - **No picks**: adds a fasten mate naming only the part's connector, and
      answers its `featureId`; the client opens the mate dialog to finish it.
    - **Picks**: `fastenToCircularEdges` mates the inserted instance to the
      first edge, then inserts and mates one more per remaining edge, serially.
      Each mate is the part's connector followed by an implicit connector the
      mate owns, at the edge's centre, so the edge's part stays put. It answers
      `fastenedCount` and records `Hint.FASTENED_TO_CIRCULAR_EDGES`.

4. On `fastenedCount` the client clears the picks.
5. An insert and fasten with nothing picked shows the circular edges tip,
   unless the quick insert tip showed, at most three times and never after the
   hint is seen.

## User-facing strings

| String                                                                                                            | Where                                                   |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| "{n} circular edges selected" / "{n} faces selected"                                                              | Card title, with picks                                  |
| "No circular edges selected" / "No faces selected"                                                                | Card title, without                                     |
| "New"                                                                                                             | Badge beside the title until the hint is seen           |
| "Select edges to automatically fasten inserted parts to."                                                         | Card description, circular edges, none picked           |
| "The part will be fastened to the selected edge."                                                                 | Card description, one edge                              |
| "A part will be inserted and fastened to each selected edge."                                                     | Card description, several edges                         |
| "Select faces to automatically fasten inserted parts to every hole in them."                                      | Card description, faces, none picked                    |
| "A part will be inserted and fastened to every hole in the selected faces."                                       | Card description, faces                                 |
| "Circular edges" / "Faces"                                                                                        | Mode, and the targets list's label                      |
| "Holes to skip"                                                                                                   | Second list's label, faces                              |
| "Select circular edges to fasten parts to."                                                                       | Targets list's prompt, in Onshape's bubble and the list |
| "Select faces to fasten parts to every hole in."                                                                  | Targets list's prompt, faces                            |
| "Select the edges of holes to leave out."                                                                         | Holes to skip's prompt                                  |
| "Clear"                                                                                                           | A list with picks, inside its box (`QueryList`)         |
| "Successfully inserted {name} and fastened it to {n} circular edges."                                             | Success toast, with picks                               |
| "Successfully inserted {name} and created a Fasten mate."                                                         | Success toast, without                                  |
| "No circular edges were found in what was selected."                                                              | Error toast, picks with no circular edge                |
| "Select either faces or circular edges to fasten to, not both."                                                   | Validation error, inconsistent picks                    |
| "{name} does not support insert and fasten."                                                                      | Error toast                                             |
| "Tip: You can select circular edges in Onshape before you insert and fasten to automatically fasten to each one." | Tip toast                                               |

## Invariants

- A request records once, an insert per instance it placed, with `fasten` true
  only once every mate is built and `preselected` when fastened to picks.
- Picks are read before anything is inserted, so picks with no circular edge
  insert nothing.
- Each picked or found edge gets its own instance and mate.
- While an assembly's library page is open, exactly one query list of the
  fasten picks is mounted: the insert menu's when one is open, else the
  navbar's.
- Mates and inserts are added one at a time: Onshape rejects a feature-list edit
  that races another.

## Failure and recovery

- **A mate fails**: the request errors, and whatever was inserted before it
  stays in the assembly, as in the Onshape UI.
- **The scan fails in a Part Studio**: the request errors and nothing is
  inserted; see [auto-assembly.md](./auto-assembly.md).
- **A pick isn't circular**: the scan finds no circular edge for it and it is left
  out; with nothing left, the request answers 400.

## Decisions

- **One way to pick, shared with Auto Assembly.** The app follows the
  selection Onshape reports and lets a focused query list take it. A focused list
  also holds a `requestSelection` limiting the Onshape window to its kind, in
  the form Onshape answers to rather than the one it documents (see Quick
  fastener's picking flow); a hovered row lights its own entity up alone, and
  leaving it lights the focused list's picks up again. The list still refuses other
  kinds, and the scan drops edges that
  aren't circular.
- **A list is always focused.** The targets' list is focused in the navbar and
  in the insert menu, so picking in Onshape and then inserting, or quick
  inserting, needs no click in the panel. A list takes what's added to the
  selection after it's focused, so what was picked before the app opened isn't
  taken.
- **Preselection lives in the navbar.** Quick insert opens no menu, so the
  picks it fastens to are made beside the insert location, which a quick
  insert also uses; the insert menu shows the same picks rather than its own.
- **No Replicate.** Onshape accepts a Replicate added through the API (200,
  `featureStatus` OK, listed by the features endpoint) but makes no copies,
  and the assembly shows nothing for it. Each edge gets its own instance and
  mate instead.
- **No fallbacks.** Onshape refusing a mate, or any other write, is an error
  the user sees, not something worked around with other features.
- **Radii from the scan.** Onshape's selection messages carry no geometry, so
  the circular edges and their radii come from Auto Assembly's hole scan, which also
  turns a face into its holes.
- **Implicit connector ids.** A mate names its implicit connector by a
  placeholder id that Onshape replaces on creation, which is undocumented but
  is how Onshape itself stores a mate to an inferred point. It's unconfirmed
  in Onshape; insert and fasten and Auto Assembly both build their mates with
  `fastenMateToCircularEdge`, so they work or fail together.

_Last reviewed: 2026-10-21_
