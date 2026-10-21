# Insert and fasten

## Purpose

Inserting a part into an assembly can also mate it in place: a fasten mate from
the part's own mate connector to either nothing yet, for the user to finish in
the mate dialog, or to circular edges the user picked in the Onshape window,
which Onshape calls preselections. Part studios derive instead and are not fastened.

## Code map

Where to start reading, in the order a fasten runs.

`src/frontend/lib/messages.ts` and `src/frontend/lib/onshape-selection.ts`

```ts
// Sends applicationInit, then takes each Onshape selection message as the whole selection.
function useMessageListener(): void;
function setOnshapeSelections(selections: OnshapeSelection[]): void;
function sendRequestCircleSelectionMessage(
    elementPath: ElementPath,
    messageId: string
): void;
function sendStopRequestMessage(elementPath: ElementPath): void;
```

`src/frontend/features/insert/circle-selection.ts`

```ts
// The edges among Onshape's selection.
function useSelectedCircles(): CircleSelection[];
function getSelectedCircles(): CircleSelection[];
// Holds Onshape to picking circular edges while the field is active.
function useCircleSelectionRequest(): void;
```

`src/frontend/features/insert/components/fasten-circles-status.tsx`,
`src/frontend/features/insert/queries.ts` and
`src/frontend/features/insert/insert-tips.ts`

```ts
// The icon, its card, the selection field and the Replicate checkbox.
function FastenCirclesStatus(props: { supportsReplicate: boolean }): ReactNode;
// Sends the selected edges and the Replicate preference with a fasten.
function useInsertMutation(
    insertable: InsertableOut,
    selection: PartialSelection | undefined,
    insertArgs: InsertArgs
);
function useFastenCirclesTip(): (fasten: boolean) => void;
```

`src/backend/features/library/insertables/routes.ts`

```text
POST /api/add-to-assembly/insertable/:insertableId    // inserts, then fastens
POST /api/toggle-replicate/library/:libraryId/insertable/:insertableId
```

`src/backend/features/library/insertables/fasten-circles.ts` and
`src/backend/features/library/insertables/circle-radii.ts`

```ts
// One instance per edge, or per diameter with a Replicate onto the rest.
async function fastenToCircles(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    args: FastenToCirclesArgs
): Promise<void>;
// Each edge's radius in metres, from the body details of the part it lies on.
async function getCircleRadii(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    circles: CircleSelection[]
): Promise<(number | undefined)[]>;
```

`src/backend/lib/onshape/objects/assembly-features.ts` and
`src/backend/features/library/insertables/fasten-query.ts`

```ts
function fastenMateToCircle(
    name: string,
    query: object,
    circle: EdgeReference
): object;
function replicateFeature(
    name: string,
    instancePath: string[],
    mateFeatureId: string,
    circles: EdgeReference[]
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
// Finds the mate connector an insertable fastens by, at load or toggle.
async function parseFastenInfo(
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType
): Promise<FastenInfo>;
// The Replicate not decided warning.
function checkInsertableSettings(input: InsertableSettingsInput): BuildIssue[];
```

## Storage

- **D1** `insertables.supports_fasten` and `fasten_info` (`FastenInfo`): set
  by a load or the toggle, cleared when fasten is turned off.
- **D1** `insertables.supports_replicate`: whether an editor allows the part to
  replicate; null until one decides. Reloads keep it.
- **KV** `seen-hints:` — `Hint.FASTENED_TO_CIRCLES`, once the user has fastened
  to circular edges; see [auth.md](./auth.md).
- **Memory** `useOnshapeSelection` — the latest selection Onshape reported, for
  this page load only.
- **localStorage** (`ui-state`): `fasten`, `replicate`, and
  `fastenCirclesTipCount`.

## Flows

### Tracking the selection

1. Once the app sends `applicationInit`, Onshape posts a message carrying the
   whole selection each time it changes. `useMessageListener` takes any message
   from the launch's server with a `selections` array as the new selection.
2. `useSelectedCircles` keeps the edges among them. Onshape's unprompted reports
   don't say an edge's geometry, so a straight edge counts until the mate fails
   on it.

### Picking circular edges

1. With **Fasten** ticked in an assembly, the insert menu shows the nut icon
   beside the insert location's: a red stop sign with nothing selected, a
   check with something. Its card lists the selected circular edges, and
   offers Replicate once more than one is selected, for a part allowed to
   replicate.
2. Clicking the field sets `isSelecting`. `useCircleSelectionRequest`, mounted
   with the icon rather than the card, shows "Select circular edges to use." in
   Onshape and sends an unbounded `requestSelection` limited to circles.
3. The card closes as the pointer leaves for Onshape, but the request holds,
   and the icon turns the primary colour to show it. A click anywhere in the app
   outside the field, closing the menu, or unticking Fasten sends
   `stopRequest`.

### Inserting

1. `useInsertMutation` reads the selected edges and the Replicate preference
   at the click, and sends them with `fasten` to `POST /add-to-assembly`.
2. The route inserts the part at the insert location, then:
    - **No edges**: adds a fasten mate naming only the part's connector, and
      answers its `featureId`; the client opens the mate dialog to finish it.
    - **Edges, one instance each**: without Replicate, `fastenToCircles`
      mates the inserted instance to the first edge, then inserts and mates one
      more per remaining edge, serially. Each mate is the part's
      connector followed by an implicit connector the mate owns, at the
      edge's centre, so the edge's part stays put.
    - **Edges, replicated**: with Replicate and more than one edge,
      `getCircleRadii` reads one assembly definition and one part's body
      details per distinct part, and the edges are grouped by diameter in the
      order picked. Each group gets one instance, the inserted one first,
      mated to its first edge, and a Replicate onto the rest of the group. An
      edge whose radius can't be read stands alone, and if Onshape refuses a
      Replicate its group falls back to one instance per edge.

    Either way it answers `fastenedCount` and records
    `Hint.FASTENED_TO_CIRCLES`.

3. On `fastenedCount` the client clears the selection, since the edges are
   used; Onshape's next selection message restores whatever it still has
   selected.
4. An insert and fasten with no edges shows the circular edges tip, unless the quick
   insert tip showed, at most three times and never after the hint is seen.

### Deciding whether a part replicates

1. A part with Insert and fasten on and `supports_replicate` null shows the
   **Replicate not decided** warning. `GET /api/build-status` adds it from
   `checkInsertableSettings` as it answers, so no load records it.
2. The Replicate switch under the part's admin toggles shows the undecided
   state with its thumb centred. Either choice, through
   `POST /api/toggle-replicate`, clears the warning and bumps the library
   version, since `InsertableOut.supportsReplicate` changes.

## Invariants

- The insert is recorded exactly once per request, with `fasten` true only once
  every mate and the Replicate are built.
- Nothing replicates unless `supports_replicate` is true: the client hides the
  option, and the route ignores `replicate` for any other part.
- Every edge a Replicate targets has the radius of its seed's edge, within
  Onshape's length tolerance (`tolerantEquals`); Onshape matches no other.
- Mates and inserts are added one at a time: Onshape rejects a feature-list edit
  that races another.

## Failure and recovery

- **A mate fails**: the request errors, and whatever was inserted before it
  stays in the assembly, as in the Onshape UI.
- **Onshape refuses a Replicate**: logged, and replaced by one instance per
  edge. A rate limit is rethrown instead, since the fallback would spend more
  of the same allocation. One Onshape accepts but fails to regenerate stays in
  the assembly for the user to fix.
- **Edge sizes can't be read**: logged, and every edge gets its own
  instance, since no Replicate is safe without them.
- **An edge isn't circular**: an edge picked before the field was active may be
  straight, which has no centre for the implicit connector, so its mate fails
  as any other does.

## Decisions

- **Mirror Onshape's selection rather than edit it.** Each selection message is
  the whole selection, so an edge removed only in the app would return with the
  next click. The field lists edges; deselecting happens in Onshape.
- **Replicate is guessed.** Onshape's feature specs omit Replicate, so the
  parameter ids in `replicateFeature` are unverified; the per-edge fallback
  keeps the insert correct either way. Replicate is off by default for that
  reason.
- **Always a new Replicate.** An insert never edits a Replicate already in the
  assembly; adding edges to an existing one is the user's to do in Onshape.
- **Sizes from the server.** Onshape's selection messages carry no geometry,
  so the route reads radii from each part's body details, whose edge ids are
  the ids a selection reports.
- **Replicate is the editor's call.** Insert and fasten suits any part with a
  mate connector, including ones whose orientation matters, which a Replicate
  can place wrongly. Existing parts were never assessed, so null means
  undecided and raises a warning rather than defaulting either way.
- **Implicit connector ids.** A mate names its implicit connector by a
  placeholder id that Onshape replaces on creation, which is undocumented.

_Last reviewed: 2026-10-21_
