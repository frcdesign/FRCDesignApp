# Edit parts

## Purpose

Changing the configuration of library parts already in an assembly. Someone
picks copies of one part in the Onshape window, changes its parameters in the
configuration menu, and every picked copy takes the change. The edit can widen
to every copy configured like a pick.

It edits copies of one part at a time. It doesn't swap a part for another, and
it doesn't reach copies inside a subassembly, which belong to that
subassembly's tab. Part Studio derives aren't edited.

Onshape's API can't change an instance's configuration
([ONSHAPE.md](../ONSHAPE.md)), so a copy is inserted again where it sits and
the old one deleted. Mates to the old copy go with it.

## Code map

`src/frontend/components/context-bar.tsx`,
`src/frontend/features/edit-parts/components/edit-parts-picker.tsx` and
`src/frontend/features/edit-parts/edit-picks.ts`

```ts
// Edit parts in the bar opens the picker under it and starts selecting.
function ContextBar(props: ContextBarProps): ReactNode;
// The Parts to edit list, with Cancel and Edit.
function EditPartsPicker(props: EditPartsPickerProps): ReactNode;
// Held for the tab.
const useEditPicks: UseBoundStore<StoreApi<EditPicksState>>;

interface EditPicksState {
    parts: OnshapeSelection[];
}
```

`src/frontend/features/edit-parts/open-edit-menu.tsx`,
`src/frontend/features/edit-parts/components/edit-menu.tsx` and
`src/frontend/features/edit-parts/queries.ts`

```ts
function openEditMenu(props: EditMenuProps): void;
// The part's parameters on the first pick's configuration, Apply to all, Update.
function EditMenuContent(props: EditMenuProps): ReactNode;
// Asked a moment after the picks or the changes move.
function useEditCheck(body: EditCheckIn | undefined): EditCheck;
function useEditPartsMutation(name: string): UseMutationResult;

interface EditMenuProps {
    assembly: ElementPath;
    insertable: InsertableOut;
    parts: OnshapeSelection[];
    /** As the picks were checked: the first's configuration, and how many copies match. */
    check: EditCheckOut;
}
```

`src/backend/features/edit-parts/routes.ts` and
`src/backend/features/edit-parts/contract.ts`

```text
POST /api/edit-parts/check    what the picks are copies of, and each pick's problem
POST /api/edit-parts          replaces each copy with its new configuration
```

```ts
interface EditCheckIn {
    assembly: ElementPath;
    /** Whole parts, as picked. */
    parts: SelectedEntity[];
    /** What the edit sets, so a copy that can't take it is marked. */
    changes?: PartialSelection;
}

interface EditCheckOut {
    /** The part the first pick is a copy of; absent when it's no library part. */
    insertableId?: string;
    /** The first pick's configuration as it is now. */
    selection?: Selection;
    /** Copies the picks name. */
    pickedCount: number;
    /** Copies whose configuration matches a pick's, the picks included. */
    matchingCount: number;
    problems: PickProblem[];
}

interface EditPartsIn extends Required<EditCheckIn> {
    /** Also every copy whose configuration matches a pick's. */
    applyToAll: boolean;
}

interface EditPartsOut {
    updated: number;
}
```

`src/backend/features/edit-parts/targets.ts` and
`src/backend/features/configurations/selection.ts`

```ts
// Every copy of the part at the assembly's top level.
function copiesOf(
    definition: OnshapeAssemblyDefinition,
    source: PartSource,
    parameters: ConfigurationParameter[]
): Copy[];
// The picks' copies, widened when asked, each with what the changes make of it.
function planEdit(args: PlanEditArgs): EditPlan;
// Undefined when a change doesn't hold once the selection settles.
function applyChanges(
    selection: Selection,
    changes: PartialSelection,
    parameters: ConfigurationParameter[]
): Selection | undefined;

/** One insert of the part: the instances it placed, where, and as what. */
interface Copy {
    /** Several for a Part Studio of several parts, placed together. */
    instanceIds: string[];
    transform: number[];
    selection: Selection;
    /** Its configuration, spelled for comparing. */
    configurationKey: string;
}

interface EditPlan {
    targets: EditTarget[];
    pickedCount: number;
    /** Copies whose configuration matches a pick's, the picks included. */
    matchingCount: number;
    problems: PickProblem[];
}
```

`SelectedEntity` and `PickProblem` are Auto Assembly's
([auto-assembly.md](./auto-assembly.md)).

## Storage

- **Memory** `useEditPicks` — the parts picked, for the tab.
- **D1** analytics, through `recordInserts`: one insert per copy replaced,
  source `edit` ([analytics.md](./analytics.md)).

Nothing else is stored. Which copies exist, and how each is configured, is read
from the assembly on every check and run.

## Flows

### Picking

1. **Edit parts** in the context bar mounts `EditPartsPicker` under it and
   focuses its list, so Onshape lets only whole parts be picked
   (`SOLID_BODIES`). The list is mounted only while the section is open.
2. A moment after the picks change, `POST /api/edit-parts/check` reads the
   assembly. The first pick's top-level instance names the part, by its
   document and element. `planEdit` marks a pick of another part, and counts
   the copies configured like a pick.
3. **Edit** is enabled once the check names a part the open library holds. A
   part of another library says to open that library.
4. **Cancel** clears the picks, stops selecting and closes the section.

### Editing

1. **Edit** opens the configuration menu on the first pick's configuration.
2. The changes are the parameters whose value differs from where the menu
   started. With none, **Update** is disabled.
3. With changes, the check runs again with them. A pick whose own
   configuration can't take them is counted in a warning.
4. **Apply to all** shows when more copies match than were picked, ticked.
5. **Update** posts the picks, the changes and the choice to
   `POST /api/edit-parts`.

### Running — `POST /api/edit-parts`

1. Reads the assembly and plans as the check does (`planEdit`). Each target's
   new configuration is its own, with the changes laid over it and settled
   (`applyChanges`). A copy that can't take them is left out.
2. With no target, answers 400 and changes nothing.
3. Inserts every target's new copy at the old copy's transform, in one
   `transformedinstances` call, from the version the library holds now.
4. Deletes the old copies' instances in one `modify` call.
5. Records an insert per copy, in the background.
6. The client clears the picks, stops selecting and closes the menu.

## User-facing strings

In [strings/edit-parts.md](../strings/edit-parts.md).

## Invariants

- An edit changes copies of one part: the first pick's.
- Only the parameters changed in the menu are applied. A copy keeps its other
  values.
- A copy whose configuration can't take the changes is never touched.
- The new copies are inserted before the old ones are deleted.
- Copies are compared by `canonicalValues`, never by a configuration key.
- Only top-level instances of the open assembly are edited.

## Failure and recovery

| Failure                          | Result                                         | Recovery                       |
| -------------------------------- | ---------------------------------------------- | ------------------------------ |
| The insert fails                 | Nothing changes                                | Run it again                   |
| The delete fails                 | Old and new copies both sit in the assembly    | Undo in Onshape, or delete one |
| A mate referenced an old copy    | The mate is deleted or left failing by Onshape | Fasten the new copy by hand    |
| A copy was moved since the check | The run reads the assembly again and uses that | Automatic                      |

## Decisions

- **Replace, and warn.** Nothing in Onshape's API changes an instance's
  configuration or re-points a mate, so the menu says mates are deleted before
  anything runs.
- **A patch, not a configuration.** Copies picked together can be configured
  differently. Applying only what changed edits them without making them the
  same part.
- **One request, not a job.** The run is three Onshape calls however many
  copies it replaces, so it needs no workflow.
- **Parts placed together are one copy.** A Part Studio of several parts
  inserts an instance of each. Instances sharing a configuration and a
  transform are replaced by one insert.
- **Following by value.** "Apply to all" reaches copies by their configuration
  now, so it covers copies made by patterns or pasted in Onshape.

_Last reviewed: 2026-11-13_
