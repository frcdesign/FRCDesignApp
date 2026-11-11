# FeatureScripts

**Status: proposed.** This is the design for review; none of it is built yet.

## Purpose

A tab of the app that lists the released FeatureScripts in the public frontend
document (robot-code's `frontend` in `[tool.fs]`), shows each one's
description and the thumbnail of its example Part Studio, and adds its feature
to the open Part Studio in one click.

It is a library, `LibraryId.FEATURESCRIPTS`, whose one group is the frontend
document and whose insertables are that document's Feature Studios. So
loading, version approval, thumbnails, search, favorites, recents, build
issues, the admin card and analytics are the library's own, and this document
covers only where a FeatureScript differs from a part.

It is not:

- **Documentation.** A feature shows its own `"Feature Type Description"`.
  Full documentation in the app is a later project; a `description` column
  is where it would hang from.
- **The custom toolbar.** Onshape refuses every toolbar call from the app's
  token ([ONSHAPE.md](../ONSHAPE.md#custom-toolbar)), so the app adds a
  feature to a Part Studio rather than a tool to someone's toolbar.
- **Beta releases.** Only the `frontend` document is loaded, never
  `frontend_beta`.
- **Assembly features.** A feature is added to Part Studios only.

## Code map

Planned, following [loading.md](./loading.md)'s shape. Names are proposals;
files that don't exist yet are named from `src/backend/`, without it.

`src/backend/features/library/library-id.ts`

```ts
enum LibraryId {
    FRC_DESIGN_LIB = "frc-design-lib",
    CONFIG_LIB = "config-lib",
    MKCAD = "mkcad",
    FEATURESCRIPTS = "featurescripts"
}

enum LibraryKind {
    PARTS = "parts",
    FEATURES = "features"
}

function libraryKind(libraryId: LibraryId): LibraryKind;
```

`src/backend/features/load/parse-document-contents.ts`

```ts
// A parts library's tabs are its Part Studios and assemblies; a features
// library's are its Feature Studios, each paired with its example.
function selectTabs(contents: DocumentContents, kind: LibraryKind): Tab[];
// "<Feature Type Name> example", in any case.
function findExample(featureName: string, partStudios: Tab[]): Tab | undefined;
```

`features/load/load-feature.ts`

```ts
// In place of `loadInsertable` for a Feature Studio.
function loadFeature(
    context: LoadContext,
    group: GroupTarget,
    tab: Tab,
    partStudios: Tab[]
): Promise<LoadedInsertable>;
```

`lib/onshape/endpoints/feature-studios.ts`

```ts
function getFeatureSpecs(
    client: OnshapeApi,
    path: ElementPath
): Promise<OnshapeFeatureSpecsResponse>;
```

`lib/onshape/objects/custom-feature.ts`

```ts
// A custom feature at its defaults, named for its Feature Type Name.
class CustomFeature {
    constructor(
        featureType: string,
        featureName: string,
        sourcePath: ElementPath,
        microversionId: string
    );
    getFeature(): object;
}
```

`src/backend/features/library/insertables/routes.ts`

```text
POST   /api/add-feature/insertable/:insertableId    adds the feature to the Part Studio named in the body
```

`src/backend/db/schema.ts`

```ts
// One row per Feature Studio insertable; the feature's own fields.
const customFeatures: SQLiteTable; // custom_features
```

| Column                    | What it holds                                                                   |
| ------------------------- | ------------------------------------------------------------------------------- |
| `insertable_id`           | Primary key, references `insertables.id`, cascading                             |
| `feature_type`            | The exported constant, e.g. `robotFrame`: what a Part Studio stores as its type |
| `description`             | `"Feature Type Description"`, with `CREDIT`'s trailing html removed             |
| `example_element_id`      | The example Part Studio's tab in the same version; null when there is none      |
| `example_microversion_id` | Its microversion, which names its thumbnail; null with it                       |

`insertables.name` holds the Feature Type Name (`Robot frame`), not the tab
name (`robotFrame.fs`), and `insertables.microversion_id` the Feature Studio's,
which goes into the namespace a Part Studio imports it by.

Frontend, under `src/frontend/features/library/components/`:

- `feature-card.tsx` — a row: the example's thumbnail, the name, the first
  line of the description.
- `feature-details.tsx` — what opens on a click, in place of the insert menu:
  a large thumbnail, the whole description, **Add to Part Studio**, and
  **Open example**.

## Storage

- **D1**: `custom_features`, above, written by every load that writes the
  insertable and deleted with it. Every other row is the library's own.
- **R2**: the example's thumbnail, under the existing
  `thumbnails/default/{elementId}/{microversionId}/{size}` with the example's
  element and microversion. A feature has no configurations, so no
  `thumbnails/config/` objects.
- **Webhooks**: the group's document webhook, as every library's
  ([loading.md](./loading.md#webhooks)). Nothing new.

## Flows

### Releasing (robot-code)

What `fs release` adds, so the app's pairing by name always has something to
find:

1. After pushing the frontend studio, it reads the feature's Feature Type
   Name (`feature_names`, as `_is_beta` already does).
2. It looks for a Part Studio named `<Feature Type Name> example` in the
   frontend document's workspace, and creates an empty one beside the studio
   if there is none, saying so: "Created Robot frame example; model an
   example in it before publishing."
3. `--publish` refuses while that example was created by this same release,
   so an empty example is never published. `fs sync-versions` publishes it
   once it's modeled.
4. `fs deprecate` renames the example `DEPRECATED <Feature Type Name> example`
   alongside its studio, so the app drops both.
5. `fs releases` and `fs status` list released FeatureScripts with no
   example, without calling Onshape beyond what they already read.

### Loading

The library's own reload ([loading.md](./loading.md#one-reload)), with these
differences in `loadGroup` when `libraryKind` is `FEATURES`:

1. Contents are filtered by `withoutDeprecated` as for parts, then split:
   Feature Studios become the tabs to load; Part Studios are kept as
   candidate examples. Everything else is ignored.
2. A Feature Studio is selected when it is new, its microversion changed, its
   example's microversion changed, its example appeared or disappeared, or
   its last load failed. An example's change re-renders only the thumbnail,
   but the whole insertable is reloaded: it is two calls.
3. `loadFeature`, per selected Feature Studio, in two steps:
    - `featurespecs-{insertable}`: `GET /featurestudios/d/{did}/v/{vid}/e/{eid}/featurespecs`.
      Exactly one spec is expected; its `featureType`, `featureTypeName` and
      description are stored. None or several raise a build issue.
    - `thumbnail-{insertable}`: the example's thumbnail, exactly as a Part
      Studio insertable's is fetched, stored under the example's element and
      microversion. No example skips the step and raises a build issue.
4. The save writes `insertables` and `custom_features` together, then the
   group as for parts. Search indexes the name and description.

No configuration, parts, fasten or records step runs: a Feature Studio has
none of them.

### Browsing

1. The **FeatureScripts** tab sits beside the libraries in the navbar.
2. With one group, the library opens straight onto it; the group list shows
   only when there are several.
3. Each feature is a `feature-card`. Search, favorites and recents work as in
   any library, with an empty selection.
4. A click opens `feature-details` in the insert menu's place, through the
   same `part` search param.

### Adding a feature — `POST /api/add-feature/insertable/:insertableId`

1. Signed in; the body names the Part Studio (`targetPath`, a workspace), with
   `isFavorite` and `source` as an insert's.
2. Reads the insertable and its `custom_features` row.
3. Posts a `CustomFeature` to the Part Studio's features
   (`addPartStudioFeature`, under `retryInsert`): `featureType` the constant,
   `namespace` `d{did}::v{vid}::e{eid}::m{mvid}` of the Feature Studio in the
   loaded version, no parameters.
4. Answers with the new feature's id, as an insert does; the client toasts
   that it was added, and that it needs its selections. Onshape shows the new
   feature in the list, failing until they're made.
5. In the background, records the recent and an `INSERT` use, as
   `finishEvenIfDisconnected` does for a part.

In an assembly, or standalone, **Add to Part Studio** is disabled with a tip
saying why.

### Opening the example

**Open example** opens the example Part Studio in the loaded version of the
frontend document, in a new browser tab. It calls nothing.

## User-facing strings

[strings/featurescripts.md](../strings/featurescripts.md).

## Analytics

Adding a feature is a **use**: an `INSERT` event with `UseTarget.PART_STUDIO`,
in `LibraryId.FEATURESCRIPTS`, with an empty selection. It counts toward the
headline uses, users and part counts like every other insert, and the
dashboard's per-library view shows the FeatureScripts library on its own. No
new `EventType` or column.

## Build issues

| Type              | Severity | Raised when                                                       |
| ----------------- | -------- | ----------------------------------------------------------------- |
| `NO_EXAMPLE`      | Warning  | No Part Studio named `<Feature Type Name> example` in the version |
| `NOT_ONE_FEATURE` | Error    | The Feature Studio defines no feature, or more than one           |

A feature with `NOT_ONE_FEATURE` is hidden: there is no single feature to add.
One with `NO_EXAMPLE` is shown, with the generic FeatureScript image in place
of a thumbnail.

## Invariants

- A feature is added from the version the library loaded, never from a
  workspace, so what's added is what was released and approved.
- An insertable's example is the Part Studio in the **same version** as its
  Feature Studio, paired only by name.
- A feature's name, type and description come from its featurespecs, never
  from its tab name.
- An example's thumbnail is stored under the example's own element and
  microversion, so it is cleaned up by the same reconciliation as every
  other thumbnail.
- A features library never runs a configuration, parts, fasten or records
  step, and a parts library never reads featurespecs.
- Adding a feature records one use, in the background, after Onshape accepted
  it.

## Failure and recovery

| What goes wrong                                                          | What happens                                                   | What puts it right                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------- |
| A release's example is renamed or deleted                                | `NO_EXAMPLE`; the card shows the generic image                 | Rename it back, version, approve                               |
| An example is published empty                                            | A blank thumbnail                                              | Model it, version, approve                                     |
| Onshape refuses the feature at its defaults                              | The add fails with Onshape's error, toasted as a failed insert | Unverified; see the open questions                             |
| Featurespecs fail                                                        | The tab fails, `INSERTABLES_FAILED` on the group               | **Reload**                                                     |
| A feature is added to a Part Studio that can't see the frontend document | Onshape refuses it                                             | The frontend document is public, so this needs it made private |

## Decisions

- **A library, not a tab of its own.** Feature Studios in a versioned
  document are what a library already loads; reusing it gets webhooks,
  approval, thumbnails, search, favorites, recents, build issues and the
  dashboard for a `LibraryKind` switch and one table, where a separate area
  would rebuild each.
- **New versions, not edits.** The library listens for
  `onshape.model.lifecycle.createversion` on the frontend document, as every
  library does, rather than `changed`: a release is final only once its
  frontend version exists, so a version is exactly when a release should
  appear. Holding it for approval stays on by default and can be turned off
  in **Hold new versions**.
- **Paired by name, made by release.** An example is found by the name
  `<Feature Type Name> example`, which `fs release` creates, so the pairing
  needs no ids stored in either repo, and survives the frontend document being
  edited by hand. The Feature Type Name, read from featurespecs in both places,
  is the one name both sides agree on.
- **The description, for now.** `"Feature Type Description"` is already
  written for every released feature, and is what Onshape shows in its own
  tooltip. Documentation in the app is a later project.
- **Added at defaults, not opened.** The API can add a feature but not open
  its dialog, so the feature lands failing until its selections are made,
  which is how Onshape shows a new feature that needs input anyway.
- **Part Studios only.** Every released feature is a Part Studio feature;
  assembly features would need a target check and a different endpoint.

## Open questions

Each wants a check from the testbench before building on it, and an entry in
[ONSHAPE.md](../ONSHAPE.md) once answered:

- Whether `POST /partstudios/.../features` accepts a custom feature with no
  parameters, filling its defaults, as it does for std features.
- Which fields `BTFeatureSpec-129` carries beside `featureType` and
  `featureTypeName`: the description, and whether the icon is reachable, which
  would let a card show the feature's own icon beside the example.
- Whether adding a feature this way puts it in the document's or the user's
  toolbar.

_Last reviewed: 2026-11-11_
