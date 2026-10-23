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
// The one focused list, and handing it each pick Onshape streams.
const useOnshapeSelection: UseBoundStore<StoreApi<SelectionState>>;
function toSelectedEntities(selections: OnshapeSelection[]): SelectedEntity[];
function QueryList(props: QueryListProps): ReactNode;
```

`src/frontend/features/insert/fasten-picks.ts`

```ts
const useFastenPicks: UseBoundStore<StoreApi<FastenPicksState>>;
// Focuses the targets' list while the menu is open.
function useFastenPicksFromSelection(mode: SelectionMode): void;
function clearFastenPicks(): void;
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
```

`src/backend/features/library/insertables/routes.ts`

```text
POST /api/add-to-assembly/insertable/:insertableId    inserts, then fastens
POST /api/toggle-replicate/library/:libraryId/insertable/:insertableId
```

`src/backend/features/quick-fastener/picked.ts` and
`src/backend/features/quick-fastener/gather.ts`, shared with Quick fastener

```ts
const entitySchema: ZodObject<...>;
function isConsistentPick(body: PickedEntities): boolean;
// The picked circular edges, in the assembly, with their radii.
async function gather(
    client: OnshapeApi,
    kv: KVNamespace,
    assembly: ElementPath,
    targets: SelectedEntity[],
    excluded: SelectedEntity[]
): Promise<Gathered>;
```

`src/backend/features/library/insertables/fasten-circular-edges.ts`

```ts
// One instance per edge, or per diameter with a Replicate onto the rest.
async function fastenToCircularEdges(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    args: FastenToCircularEdgesArgs
): Promise<void>;
function groupByDiameter(
    edges: AssemblyCircularEdge[]
): AssemblyCircularEdge[][];
```

`src/backend/features/quick-fastener/replicate.ts`, shared with Quick fastener

```ts
// Its faces, when the group is every edge of its size on whole picked faces, else its edges.
function replicateMatch(
    group: AssemblyCircularEdge[],
    all: AssemblyCircularEdge[]
): ReplicateMatch;
// Onshape refusing it is an error in the user's words, with Onshape's own.
async function addReplicate(
    onshapeApi: OnshapeApi,
    assembly: ElementPath,
    args: ReplicateArgs
): Promise<void>;
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
type ReplicateMatch = { edges: EdgeReference[] } | { faces: FaceReference[] };
function replicateFeature(
    name: string,
    instancePaths: string[][],
    mateFeatureId: string,
    match: ReplicateMatch
): object;
// The inserted part's own connector, as a query on its instance.
function getFastenQuery(
    targetElementType: ElementType,
    path: string[],
    fastenInfo: FastenInfo
): object;
```

`src/backend/features/load/parse-fasten.ts` and
`src/backend/features/build-checker/checks.ts`

```ts
// Finds the mate connector an insertable fastens by, at load or toggle: a
// mate connector feature, or a generated studio's own feature.
async function parseFastenInfo(
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    isGenerated = false
): Promise<FastenInfo>;
// The Replicate not decided warning.
function checkInsertableSettings(input: InsertableSettingsInput): BuildIssue[];
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

1. Once the app sends `applicationInit`, Onshape streams each pick as it's
   made, and `useOnshapeSelection` hands it to the focused `QueryList`, as in
   Quick fastener.
2. With **Fasten** ticked in an assembly, the insert menu shows the cursor icon
   beside the insert location's: a red stop sign with nothing picked, a check
   with something. `useFastenPicksFromSelection` focuses the targets' list, so
   anything picked while the menu is open joins it; what was picked before it
   opened isn't known.
3. The card holds the mode (**Circular edges** or **Faces**), the targets'
   query list, and in faces mode **Holes to skip**. It stays mounted while
   hidden (`keepMounted`), so its lists take picks with the card closed, and
   the icon turns the primary colour while one of them is focused. Hovering a
   row lights its entity up; clicking a list shows its prompt in Onshape.
4. Changing the mode clears the picks.

### Inserting

1. `useInsertMutation` reads the picks, the mode and the Replicate preference
   at the click, and sends them with `fasten` to `POST /add-to-assembly`.
   `isConsistentPick` refuses edges as faces, or faces as edges.
2. With picks, the route calls `gather` first, which scans each Part Studio
   holding a pick (cached) and answers the picked circular edges in the
   assembly with their radii: each picked edge that is circular, or every
   circular edge of each picked face, less the skipped holes. None found
   answers 400 and inserts nothing.
3. It inserts the part at the insert location, then:
    - **No picks**: adds a fasten mate naming only the part's connector, and
      answers its `featureId`; the client opens the mate dialog to finish it.
    - **One instance each**: `fastenToCircularEdges` mates the inserted
      instance to the first edge, then inserts and mates one more per remaining
      edge, serially. Each mate is the part's connector followed by an implicit
      connector the mate owns, at the edge's centre, so the edge's part stays
      put.
    - **Replicated**: with Replicate and a part allowed it, `groupByDiameter`
      groups the edges by radius in the order found. Each group gets one
      instance, the inserted one first, mated to its first edge, and a
      Replicate onto the rest of the group (`addReplicate`). It matches the
      group's faces ("Match edges on face") when every edge of the group's
      size on them is in it, which holds for a face picked with no hole
      skipped, and so follows the face as holes are added; otherwise it
      matches the edges one by one (`replicateMatch`).

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

| String                                                                                                                             | Where                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| "{n} circular edges selected" / "{n} faces selected"                                                                               | Card title, with picks                                  |
| "No circular edges selected" / "No faces selected"                                                                                 | Card title, without                                     |
| "New"                                                                                                                              | Badge beside the title until the hint is seen           |
| "Select edges to automatically fasten this part to."                                                                               | Card description, circular edges, none picked           |
| "The part will be fastened to the selected edge."                                                                                  | Card description, one edge                              |
| "A part will be inserted and fastened to each selected edge."                                                                      | Card description, several edges                         |
| "One part will be fastened per edge diameter and replicated onto the other edges of that diameter."                                | Card description, several edges, Replicate              |
| "Select faces to automatically fasten this part to every hole in them."                                                            | Card description, faces, none picked                    |
| "A part will be inserted and fastened to every hole in the selected faces."                                                        | Card description, faces                                 |
| "One part will be fastened per hole diameter and replicated onto the other holes of that diameter."                                | Card description, faces, Replicate                      |
| "Circular edges" / "Faces"                                                                                                         | Mode, and the targets list's label                      |
| "Holes to skip"                                                                                                                    | Second list's label, faces                              |
| "Select circular edges to fasten this part to."                                                                                    | Targets list's prompt, in Onshape's bubble and the list |
| "Select faces to fasten this part to every hole in."                                                                               | Targets list's prompt, faces                            |
| "Select the edges of holes to leave out."                                                                                          | Holes to skip's prompt                                  |
| "Click to select"                                                                                                                  | An empty list, not focused (`QueryList`)                |
| "Replicate"                                                                                                                        | Checkbox                                                |
| "Insert one part per hole diameter and replicate it onto the other holes of that diameter, rather than inserting a part for each." | Replicate's info tooltip                                |
| "Successfully inserted {name} and fastened it to {n} circular edges."                                                              | Success toast, with picks                               |
| "Successfully inserted {name} and created a Fasten mate."                                                                          | Success toast, without                                  |
| "No circular edges were found in what was selected."                                                                               | Error toast, picks with no circular edge                |
| "Faces fasten every hole in them, less the edges excluded; circular edges are fastened alone."                                     | Validation error, inconsistent picks                    |
| "{name} does not support insert and fasten."                                                                                       | Error toast                                             |
| "Tip: select circular edges in Onshape before you insert and fasten, and the part is fastened to each of them."                    | Tip toast                                               |
| "Onshape refused the Replicate ({Onshape's message})."                                                                             | Error toast                                             |
| "Replicate not decided"                                                                                                            | Build check title                                       |
| "Allow replicate for parts that sit the same way on every circular edge, like bolts, and not for parts with an orientation."       | Build check description                                 |
| "Replicate"                                                                                                                        | Editor switch label                                     |
| "Undecided: allow for parts that sit the same way on every edge" / "Allows replicating onto several circular edges"                | Editor switch description, undecided / decided          |

## Invariants

- The insert is recorded exactly once per request, with `fasten` true only once
  every mate and the Replicate are built.
- Picks are read before anything is inserted, so picks with no circular edge
  insert nothing.
- Nothing replicates unless `supports_replicate` is true: the client hides the
  option, and the route ignores `replicate` for any other part.
- Every edge a Replicate targets has the radius of its seed's edge, within
  Onshape's length tolerance (`sameRadius`); Onshape matches no other.
- A Replicate matches a face only when every edge of its seed's size on that
  face is in its group: a face with a hole skipped is matched edge by edge.
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

- **One way to pick, shared with Quick fastener.** The app listens to the
  picks Onshape streams and lets a focused query list take them.
  `requestSelection` only limits what the graphics window lets be picked, and
  a highlight cancels it, so none is sent: the list refuses other kinds, and
  the scan drops edges that aren't circular.
- **The list stays focused.** The targets' list is focused while the menu is
  open, so picking in Onshape and then inserting needs no click in the panel.
  Each message names only the latest pick, so what was picked before the menu
  opened can't be taken.
- **Replicate is copied from Onshape.** Onshape's feature specs omit
  Replicate, so `replicateFeature` is shaped as Onshape answers a Replicate
  matching edges on a face; the individual edges' `INDIVIDUAL` scope is
  unconfirmed. Replicate is off by default until both are seen working.
- **No fallbacks.** Onshape refusing a Replicate, or any other write, is an
  error the user sees, not something worked around with other features.
- **Faces, not planes.** Of Onshape's three ways to match, picked faces map to
  "Match edges on face"; "Match edges on plane" is never used.
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
