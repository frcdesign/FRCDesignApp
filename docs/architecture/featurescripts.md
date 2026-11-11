# FeatureScripts

**Status: proposed.** This is the design for review; none of it is built yet.

## Purpose

A tab of the app, beside the libraries, that lists the released FeatureScripts
in the public frontend document (robot-code's `frontend` in `[tool.fs]`). It
shows each one's description, release version and the thumbnail of its
example Part Studio, and adds its feature to the open Part Studio in one
click.

It is its own area, not a library. A library is many documents of parts,
curated by an admin team, with configurations, and is measured in uses of
parts. FeatureScripts are one document, released by the owner from robot-code,
with no configurations, and are measured in features added. They share the
infrastructure underneath, made generic where it is library-shaped today (see
[Shared infrastructure](#shared-infrastructure)), and none of the library's
tables, metrics or pages.

It is not:

- **Documentation.** A feature shows its own `"Feature Type Description"`.
  Documentation in the app is a later project, and `featurescripts.description`
  is where it would hang from.
- **The custom toolbar.** Onshape refuses every toolbar call from the app's
  token ([ONSHAPE.md](../ONSHAPE.md#custom-toolbar)), so the app adds a feature
  to a Part Studio rather than a tool to someone's toolbar.
- **Beta releases.** Only `frontend` is loaded, never `frontend_beta`.
- **Assembly features.** Every released feature is a Part Studio feature.

## Code map

Planned. Names are proposals; files that don't exist yet are named from
`src/backend/` or `src/frontend/`, without it.

`features/featurescripts/routes.ts`

```text
GET    /api/featurescripts                   every shown feature, cached under the document's version
POST   /api/featurescripts/:featureId/add    adds it to the Part Studio in the body
POST   /api/featurescripts/reload            owner: loads the latest version now
```

`features/featurescripts/workflow.ts`

```ts
// Loads one version of the frontend document; one run at a time.
class LoadFeatureScriptsWorkflow extends WorkflowEntrypoint<
    AppBindings,
    LoadParams
> {}

interface LoadParams {
    /** Absent for a webhook's run. */
    sessionId?: string;
    /** Reloads every feature, unchanged or not. */
    force: boolean;
}
```

`features/featurescripts/parse.ts`

```ts
// Feature Studios to load, and Part Studios as candidate examples, deprecated tabs dropped.
function splitTabs(contents: DocumentContents): {
    studios: Tab[];
    partStudios: Tab[];
};
// "<Feature Type Name> example", in any case.
function findExample(featureName: string, partStudios: Tab[]): Tab | undefined;
// From the newest frontend version named "<Feature Type Name> - v<semver>".
function findReleaseVersion(
    featureName: string,
    versions: OnshapeVersion[]
): string | undefined;
// "Feature Type Description" without CREDIT's trailing html.
function cleanDescription(description: string): string;
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

`features/featurescripts/contract.ts`

```ts
interface FeatureScriptsOut {
    /** The frontend version loaded, for **Open example**. */
    documentId: string;
    versionId: string;
    features: FeatureScriptOut[];
}

interface FeatureScriptOut {
    id: string;
    name: string;
    description: string;
    /** e.g. "1.3.0"; absent when no version names it. */
    releaseVersion?: string;
    exampleElementId?: string;
    /** Absent without an example. */
    thumbnailUrls?: ThumbnailUrls;
    /** Owner only. */
    problems?: FeatureScriptProblem[];
}

enum FeatureScriptProblem {
    NO_EXAMPLE = "no-example",
    NOT_ONE_FEATURE = "not-one-feature",
    LOAD_FAILED = "load-failed"
}
```

Frontend, under `features/featurescripts/`:

- `queries.ts` — the list, the add mutation, and the owner's reload.
- `components/featurescript-card.tsx` — a row: the example's thumbnail, the
  name, the release version, the description's first line.
- `components/featurescript-details.tsx` — what opens on a click: a large
  thumbnail, the whole description, **Add to Part Studio**, **Open example**.
- `routes/app/featurescripts.tsx` and `routes/app/featurescripts.$featureId.tsx`
  — the tab and the details, `UtilityTab.FEATURESCRIPTS`.

## Storage

**D1**, in `features/featurescripts/schema.ts` (nothing outside the area reads
them, and they hold no foreign key into the rest; added to
`drizzle.config.ts`):

- `featurescripts_document` — one row: `document_id`, the loaded
  `version_id` and when it was created, `cache_version` (bumped by every load
  that wrote).
- `featurescripts` — one row per Feature Studio in the loaded version:

| Column                    | What it holds                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `id`                      | Random, kept across loads for the same `element_id`, so analytics and urls stay stable |
| `element_id`              | The frontend Feature Studio's tab                                                      |
| `microversion_id`         | Its microversion, which goes into the namespace a Part Studio imports it by            |
| `feature_type`            | The exported constant, e.g. `robotFrame`: what a Part Studio stores as its type        |
| `name`                    | The Feature Type Name, e.g. `Robot frame`, never the tab name                          |
| `description`             | From `cleanDescription`                                                                |
| `release_version`         | From `findReleaseVersion`; null when none matches                                      |
| `example_element_id`      | The example Part Studio in the same version; null when there is none                   |
| `example_microversion_id` | Its microversion, which names its thumbnail; null with it                              |
| `thumbnail_urls`          | As `insertables`'; null without an example                                             |
| `problems`                | `FeatureScriptProblem[]`                                                               |
| `sort_order`              | The tab order in the frontend document                                                 |

**R2**: the example's thumbnail, under the existing
`thumbnails/default/{elementId}/{microversionId}/{size}`, with the example's
element and microversion.

**KV**: `featurescripts-load` — the run holding the load, a day as a backstop,
as `library-reload:` is for a library.

**Webhooks**: one `onshape_webhooks` row, subject
`WebhookSubject.FEATURESCRIPTS`, subject id the frontend document's id.

**Configuration**: `FEATURESCRIPTS_DOCUMENT_ID`, the frontend document, in
`wrangler.jsonc`'s vars; the binding `LOAD_FEATURESCRIPTS_WORKFLOW`.

## Flows

### Releasing (robot-code)

What `fs release` adds, so the app's pairing by name always has something to
find:

1. `fs check` requires a released feature's Feature Type Name to be the name
   `feature_name_for` makes of its tab (`robotFrame.fs` → `Robot frame`), so
   the version names, the example and the app all agree on one name.
2. After pushing the frontend studio, the release looks for a Part Studio
   named `<Feature Type Name> example` in the frontend workspace, and creates
   an empty one beside the studio if there is none, saying so: "Created Robot
   frame example; model an example in it before publishing."
3. `--publish` refuses while that example was created by this same release,
   so an empty example is never published. `fs sync-versions` publishes it
   once it's modeled.
4. `fs deprecate` renames the example `DEPRECATED <Feature Type Name> example`
   alongside its studio, so the app drops both.

### Loading — `LoadFeatureScriptsWorkflow`

Started by the webhook for a new frontend version, and by the owner's
**Reload**. A version is final once it's in the frontend document, so a new
version loads at once, with no approval.

1. Claims the load, waiting while another run holds it, as a library reload
   does.
2. `document`, `versions`: the document, and its versions (the latest is the
   one to load; the rest name each feature's release).
3. Ends here when that version is the one loaded, unless forced.
4. `contents`: the version's tabs, split by `splitTabs`.
5. Selects the Feature Studios that are new, whose own or whose example's
   microversion changed, whose example appeared or went, or that failed last
   time; every one when forced.
6. Per selected studio, under the shared limiter:
    - `featurespecs-{element}`: exactly one spec is expected; its
      `featureType`, `featureTypeName` and description are kept. None or
      several is `NOT_ONE_FEATURE`, and the feature is hidden.
    - `thumbnail-{element}`: the example's, stored by `uploadThumbnailsStep`
      under the example's element and microversion. No example skips the step:
      `NO_EXAMPLE`, and the card shows the generic FeatureScript image.
7. `save`: every row in one batch — the loaded, the unchanged carried over
   with their release versions recomputed, the removed deleted — and the
   document row with its version and bumped `cache_version`. Then pushes
   `featurescripts-changed` to open clients.
8. `delete-stale-thumbnails`, never fatal.
9. `register-webhook`: `ensureWebhook` for the document.
10. Releases the load.

Steps retry as a library's do (`ONSHAPE_STEP_RETRIES`, `THUMBNAIL_RETRIES`). It
reads Onshape as the owner when the owner asked, and otherwise borrows the
owner's background session; no one else's.

### Browsing

1. **FeatureScripts** sits in the navbar after the libraries.
2. `GET /api/featurescripts` answers the shown features in tab order, cached
   under `cache_version`, as a library is. The owner also gets the hidden ones
   and each one's problems.
3. The search box filters the list on the client, by name and description:
   it is a few dozen features, not an index's worth.
4. A click opens the details at `/app/featurescripts/<featureId>`.

### Adding a feature — `POST /api/featurescripts/:featureId/add`

1. Signed in; the body names the Part Studio (`targetPath`, a workspace) and
   where the add started (`source`: the list, or search).
2. Reads the feature and the loaded version.
3. Posts a `CustomFeature` to the Part Studio's features
   (`addPartStudioFeature`, under `retryInsert`, finished by
   `finishEvenIfDisconnected`): `featureType` the constant, `namespace`
   `d{did}::v{vid}::e{eid}::m{mvid}` of the Feature Studio in the loaded
   version, no parameters.
4. Answers with the new feature's id; the client toasts that it was added and
   needs its selections. Onshape shows it in the feature list, failing until
   they're made.
5. In the background, records a `FEATURE_ADD` event.

In an assembly, or standalone, **Add to Part Studio** is disabled with a tip
saying why.

### Opening the example

**Open example** opens the example Part Studio in the loaded version, in a
new browser tab. It calls nothing.

## Analytics

Adding a feature is not a use: it isn't a part, so it counts toward no
library's uses, users or part counts. It is its own event,
`EventType.FEATURE_ADD`, with `libraryId` null, as a version run is.

- **Columns**, decided in `logged-event.ts` beside `NOT_A_USE`:
  `featureScriptId`, `featureType`, `featureReleaseVersion`, `source`, and the
  target Part Studio's `documentId`, `instanceId` and `elementId`.
  `NOT_A_FEATURE_ADD` nulls them for every other event.
- **Rollups**, in `rollupWrites`: `daily_feature_adds` (day, feature type →
  adds) and `daily_feature_users` (day, feature type, user), so distinct users
  per feature and in total come from rollups, never from scanning events.
  Keyed by feature type, which never changes for a released feature, so a
  feature's history survives its row being replaced.
- **Dashboard**: a **FeatureScripts** section on the overview (adds and users
  over the range, against the previous season, and adds per day), and a
  **FeatureScripts** page with one row per feature: adds, users, the share of
  adds, and its release version.

## User-facing strings

[strings/featurescripts.md](../strings/featurescripts.md).

## Shared infrastructure

What this area reuses, and the change each needs to stop assuming a library.
Each is a refactor that lands, with its tests, before the area does.

| Piece                                                             | Today                                                | Change                                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `ensureWebhook`, the delivery route                               | Subjects `DOCUMENT` (a library's) and `TEAM`         | A `FEATURESCRIPTS` subject; the delivery's `switch` sends its `createversion` to the workflow       |
| `LoadContext`, `getOnshapeApiFromContext`                         | Holds a `libraryId`, and borrows its team's sessions | Holds the libraries whose teams may lend a session; FeatureScripts passes none, so only the owner's |
| `ONSHAPE_STEP_RETRIES`, `uploadThumbnailsStep`, `prefixSteps`     | Already generic                                      | None                                                                                                |
| The library's claim in `jobs.ts`                                  | Keyed by library, in `library-reload:`               | The claim-and-wait loop moves to `lib/`, taking its `kvStore`; each area declares its own           |
| `thumbnailKey`, `putThumbnail`, the serving route                 | Keyed by element and microversion                    | None                                                                                                |
| `deleteStaleThumbnails`                                           | Reads what's live from `groups` and `insertables`    | Takes the live subjects from its caller, so each area says what it points at                        |
| `retryInsert`, `addPartStudioFeature`, `finishEvenIfDisconnected` | Already generic                                      | None                                                                                                |
| `ClientRelay`                                                     | Pushes job status, library versions, renders         | One more message, `featurescripts-changed`                                                          |
| `record` in analytics                                             | Every event shape spelled out in `logged-event.ts`   | One more shape and its rollups, as the version manager's was added                                  |

Favorites and recents stay the library's: their rows reference insertables,
and a list this short has little use for either.

## Invariants

- A feature is added from the version loaded, never from a workspace, so
  what's added is what was released.
- An example is the Part Studio in the **same version** as its Feature
  Studio, paired only by name.
- A feature's name, type and description come from its featurespecs, never
  from its tab name.
- One load runs at a time, and only the run holding the load releases it.
- An example's thumbnail is stored under the example's element and
  microversion, and is live while a `featurescripts` row names it.
- A feature add is never a use: it writes no library rollup, and a use never
  writes a FeatureScripts rollup.
- A feature add is recorded once, in the background, after Onshape accepted
  it.
- A load reads Onshape as the owner, its own session or a borrowed one, and
  never as a library's team.

## Failure and recovery

| What goes wrong                                     | What happens                                   | What puts it right                 |
| --------------------------------------------------- | ---------------------------------------------- | ---------------------------------- |
| An example is renamed or deleted                    | `NO_EXAMPLE`; the card shows the generic image | Rename it back, cut a version      |
| An example is published empty                       | A blank thumbnail                              | Model it, cut a version            |
| Featurespecs or a thumbnail fail past their retries | `LOAD_FAILED` on that feature; the rest save   | **Reload**                         |
| Onshape cancels or deactivates the webhook          | New versions don't load                        | The next **Reload** registers it   |
| No owner session to borrow                          | A webhook's load fails                         | The owner opens the app            |
| Onshape refuses the feature at its defaults         | The add fails, toasted                         | Unverified; see the open questions |

## Decisions

- **Its own area, on shared plumbing.** A library's tables, metrics and pages
  assume parts: configurations, admin teams, uses. FeatureScripts are measured
  and shown differently, so they get their own tables, event and pages, and the
  plumbing both need is made generic once rather than built twice.
- **New versions, not edits, and no approval.** The webhook listens for
  `onshape.model.lifecycle.createversion` rather than `changed`: a release is
  final only once its frontend version exists, and it was reviewed in
  robot-code before that. So a new version loads at once.
- **Paired by name, made by release.** An example is found as
  `<Feature Type Name> example`, which `fs release` creates, so the pairing
  needs no ids stored in either repo and survives the document being edited by
  hand. `fs check` keeps the Feature Type Name and the tab's name in step, so
  every name built from it agrees.
- **The release version from the frontend's version names.** The versions
  list is read anyway, and each release names its version
  `<Feature> - v<semver>`, so the version costs no call.
- **The description, for now.** `"Feature Type Description"` is already written
  for every released feature, and is what Onshape shows in its own tooltip.
- **Added at defaults, not opened.** The API can add a feature but not open
  its dialog, so the feature lands failing until its selections are made, which
  is how Onshape shows a new feature that needs input anyway.
- **Filtered on the client.** A few dozen features need no search index.
- **Opens aren't counted.** Only an add is recorded; counting how often a
  feature's details are opened would need a call from the client for each,
  and can be added beside `FEATURE_ADD` if adds alone don't say enough.

## Open questions

Each wants a check from the testbench before building on it, and an entry in
[ONSHAPE.md](../ONSHAPE.md) once answered:

- Whether `POST /partstudios/.../features` accepts a custom feature with no
  parameters, filling its defaults, as it does for std features.
- Which fields `BTFeatureSpec-129` carries beside `featureType` and
  `featureTypeName`: the description, and whether the icon is reachable, which
  would let a card show the feature's own icon.
- Whether adding a feature this way puts it in the document's or the user's
  toolbar.

_Last reviewed: 2026-11-11_
