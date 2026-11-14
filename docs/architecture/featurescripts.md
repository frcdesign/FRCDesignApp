# FeatureScripts

**Status: partly built.** The tables, the list, icon, add, favorite,
visibility and stats routes, recording each add, the tab with its
categories, favorites, row buttons, owner's card and popup, and feedback are
built. The manifest, loading from it, the robot-code release changes and the
dashboard's section are still the design below;
names in the code map that don't exist yet are named from `src/backend/`
without it.

## Purpose

A tab of the app, beside the libraries, that lists the released FeatureScripts
in the public frontend document (robot-code's `frontend` in `[tool.fs]`),
grouped by category: the folder each is in there, such as Lightening, Basic
operations or Parts. It shows each one by its icon and name, lets a
signed-in person favorite it, opens it onto
its example Part Studio's thumbnail as a hero image, adds its feature to the
open Part Studio in one click, opens its Feature Studio or its source on
GitHub, and takes feedback on it, as a part's **Report an issue** does. What it
knows of each feature comes from one file robot-code's release writes into the
frontend document, [the manifest](#the-manifest).

It is its own area, not a library. A library is many documents of parts,
curated by an admin team, with configurations, and is measured in uses of
parts. FeatureScripts are one document, released by the owner from robot-code,
with no configurations, and are measured in features added. They share the
infrastructure underneath, made generic where it is library-shaped today (see
[Shared infrastructure](#shared-infrastructure)), and none of the library's
tables, metrics or pages.

It is not:

- **Documentation.** A feature shows its own `"Feature Type Description"`,
  without its credit line. Documentation in the app is a later project, and
  `featurescripts.description` is where it would hang from.
- **The custom toolbar.** Onshape refuses every toolbar call from the app's
  token ([ONSHAPE.md](../ONSHAPE.md#custom-toolbar)), so the app adds a feature
  to a Part Studio rather than a tool to someone's toolbar.
- **Beta releases.** Only `frontend` is loaded, never `frontend_beta`.
- **Assembly features.** Every released feature is a Part Studio feature.

## Code map

`src/backend/features/featurescripts/routes.ts`

```text
GET    /api/featurescripts-version           the cache version keying the list
GET    /api/featurescripts?v=                every feature, the same for every caller, immutable under its version
GET    /api/featurescripts/icon/:elementId   a feature's icon from R2, by ?v=<microversion>, sandboxed
GET    /api/featurescripts/favorites         the caller's favorites, oldest first
POST   /api/featurescripts/:featureId/favorite
DELETE /api/featurescripts/:featureId/favorite
POST   /api/featurescripts/:featureId/visibility    owner: shows or hides it, bumping the cache version
POST   /api/featurescripts/:featureId/add    adds it to the Part Studio in the body
GET    /api/featurescripts/stats             owner: each feature's adds, users and favorites, all time
POST   /api/featurescripts/reload            owner: loads the latest version now (not built)
```

`src/backend/features/featurescripts/store.ts`

```ts
function getFeatureScriptsOut(db: Db): Promise<FeatureScriptsOut>;
function getCacheVersion(db: Db): Promise<number>;
function iconKey(elementId: string, microversionId: string): string;
function iconUrl(elementId: string, microversionId: string): string;
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

`features/featurescripts/manifest.ts`

```ts
// The manifest tab, "featurescripts.json" at the document's top level.
function findManifestTab(contents: DocumentContents): Tab | undefined;
// Refuses a file of another schema version, or one that doesn't parse.
function parseManifest(json: unknown): FeatureScriptsManifest;
// The Part Studio named "<Feature Type Name> example", in any case, outside a deprecated folder.
function findExample(
    contents: DocumentContents,
    featureName: string
): Tab | undefined;
// The outermost folder holding a tab; undefined at the top level.
function categoryOf(
    contents: DocumentContents,
    elementId: string
): string | undefined;
```

The manifest's shape is in [The manifest](#the-manifest).

`lib/onshape/endpoints/blobs.ts`

```ts
function downloadBlob(client: OnshapeApi, path: ElementPath): Promise<Response>;
```

`src/backend/lib/onshape/objects/custom-feature.ts`

```ts
// A custom feature at its defaults; the client opens its dialog for the rest.
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

`src/backend/features/featurescripts/contract.ts`

```ts
interface FeatureScriptsOut {
    /** The frontend version loaded, for **Open example**; absent before the first load. */
    documentId?: string;
    versionId?: string;
    /** In the frontend document's tab order. */
    features: FeatureScriptOut[];
}

interface FeatureScriptOut {
    id: string;
    /** The frontend Feature Studio's tab, which **Get FeatureScript** opens. */
    elementId: string;
    name: string;
    description: string;
    /** The frontend document's folder it is in; absent at the top level. */
    category?: string;
    /** Shown to everyone; the owner sees a hidden one too, marked. */
    isVisible: boolean;
    /** Absent without an icon tab. */
    iconUrl?: string;
    exampleElementId?: string;
    /** Absent without an example. */
    thumbnailUrls?: ThumbnailUrls;
    /** e.g. "1.3.0", from the manifest; shown to the owner alone. */
    releaseVersion?: string;
    /** The released file on GitHub, at its release's tag. */
    sourceUrl?: string;
    /** Shown to the owner alone. */
    problems: FeatureScriptProblem[];
}

enum FeatureScriptProblem {
    NO_EXAMPLE = "no-example",
    NO_ICON = "no-icon",
    LOAD_FAILED = "load-failed"
}

// Left out of everyone's list but the owner's.
function isHidden(feature: FeatureScriptOut): boolean;

const featureScriptVisibilityBody: ZodObject; // isVisible

const addFeatureScriptBody: ZodObject; // targetPath, a Part Studio in a workspace

interface AddFeatureScriptOut {
    /** The feature to open in the Part Studio. */
    featureId?: string;
}
```

`src/frontend/features/featurescripts/queries.ts`

```ts
function useFeatureScriptsQuery(): UseQueryResult<FeatureScriptsOut>;
// Posts the add, then sends Onshape `openFeatureDialog` for the new feature.
function useAddFeatureScriptMutation(
    feature: FeatureScriptOut
): UseMutationResult<AddFeatureScriptOut>;
// Not offered standalone; disabled, saying why, in an assembly.
function useAddAvailability(): AddAvailability;
function useExampleUrl(feature: FeatureScriptOut): string | undefined;
function useIsOwner(): boolean;
function useFeatureScriptFavoritesQuery(): UseQueryResult<FeatureScriptFavoritesOut>;
// Shown at once, and put right by the refetch either way.
function useToggleFavoriteMutation(
    feature: FeatureScriptOut
): UseMutationResult<unknown, Error, boolean>;

type AddAvailability =
    | { offered: false }
    | { offered: true; disabledReason?: string };
```

`src/frontend/features/featurescripts/open-featurescript-menu.tsx`

```ts
// The popup, opened as the insert menu is, titled with the icon and name.
function openFeatureScriptMenu(feature: FeatureScriptOut): void;
```

`src/frontend/features/featurescripts/categories.ts`

```ts
// In the folders' order in the document, the uncategorized last.
function groupByCategory(features: FeatureScriptOut[]): FeatureScriptCategory[];

interface FeatureScriptCategory {
    /** The frontend document's folder; undefined for the features at its top level. */
    name?: string;
    features: FeatureScriptOut[];
}
```

Under `src/frontend/features/featurescripts/components/`:

- `featurescript-list.tsx` — Favorites and the category sections, filtered
  by `featurescript-search-bar.tsx`, the navbar's search, through the
  `useFeatureScriptsSearch` store (`src/frontend/features/featurescripts/search.ts`).
- `featurescript-favorite-button.tsx` — the heart. Favoriting has no menu
  item: the heart is on every row and in the popup.
- `featurescript-menu-items.tsx` — `FeatureScriptMenuItems`, the one menu a
  row's ⋯ and right-click and the popup's ⋯ share: only what no button beside
  it does, **Get FeatureScript**, **Open example** and **View code**, the
  popup's leaving out **Open example**, its own button. Adding and favoriting
  are the buttons'.
- `featurescript-card.tsx` — a row: the icon inline before the name and the
  owner's card, then, in `ItemRow`'s `actions`, an outlined **Add** and the
  heart, and last the ⋯ menu.
- `featurescript-menu.tsx` — the popup a row opens: the example's thumbnail
  as a hero image across the top, the whole description, and a footer with
  the heart, the owner's card and a ⋯, as the insert menu's has, then **Open
  example** and **Add to Part Studio**.
- `featurescript-add-button.tsx` — the row's outlined **Add**
  (`RowActionButton`, in `src/frontend/components/row-action-button.tsx`) or
  the popup's filled **Add to Part Studio**.
- `featurescript-status.tsx` — the owner's card, built from a part's admin
  card's own pieces (`CardSections`, `CardSection`, `SwitchRow`, `Stat`): a
  status icon beside the name (an eye struck through when hidden, else the
  worst problem's) opening a hover card with the same sections: **Build
  checks**, each problem as a tinted callout with how to fix it, shown only
  when there is one; **Settings**, with **Visible to users** and the
  **Version**; and **Usage**, with adds, users and favorites from
  `GET /api/featurescripts/stats`, fetched only while it is open. The sections
  open and close with the admin card's, as one setting. Nothing for anyone
  else.
- `featurescript-icon.tsx` — the icon as an `<img>`, or the generic puzzle
  piece.

The tab is `UtilityTab.FEATURESCRIPTS`: `src/frontend/routes/app/featurescripts/route.tsx`
loads the version and the list, and `index.tsx` under it shows
`FeatureScriptList`.

## Storage

**D1**, in `src/backend/features/featurescripts/schema.ts` (nothing outside the area reads
them, and they hold no foreign key into the rest; added to
`drizzle.config.ts`):

- `featurescripts_document` — one row: `document_id`, the loaded
  `version_id`, and `cache_version` (bumped by every load that wrote).
- `featurescripts` — one row per Feature Studio in the loaded version:

| Column                    | What it holds                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `id`                      | Random, kept across loads for the same `element_id`, so analytics and urls stay stable |
| `element_id`              | The frontend Feature Studio's tab                                                      |
| `microversion_id`         | Its microversion, which goes into the namespace a Part Studio imports it by            |
| `feature_type`            | From the manifest: the exported constant, e.g. `robotFrame`, a Part Studio's type      |
| `name`                    | From the manifest: the Feature Type Name, e.g. `Robot frame`, never the tab name       |
| `description`             | From the manifest, its credit already cut by robot-code                                |
| `release_version`         | From the manifest, e.g. `1.3.0`; shown to the owner alone                              |
| `source_url`              | From the manifest: the released file on GitHub at its release's tag                    |
| `example_element_id`      | The Part Studio named `<Feature Type Name> example` in the version; null without one   |
| `example_microversion_id` | Its microversion, which names its thumbnail; null with it                              |
| `icon_element_id`         | The icon tab the manifest names; null when it names none                               |
| `icon_microversion_id`    | Its microversion, which names its R2 object; null with it                              |
| `thumbnail_urls`          | As `insertables`'; null without an example                                             |
| `problems`                | `FeatureScriptProblem[]`                                                               |
| `category`                | The folder holding the Feature Studio in the frontend document; null at its top level  |
| `is_visible`              | The owner's choice, true for a new feature; a load never writes it                     |
| `sort_order`              | The tab order in the frontend document                                                 |

- `featurescript_favorites` — `user_id`, `featurescript_id` (referencing
  `featurescripts.id`, cascading, so a feature gone from the document takes
  its favorites with it) and `created_at`; one row per person and feature,
  kept until unfavorited.

**R2**:

- the example's thumbnail, under the existing
  `thumbnails/default/{elementId}/{microversionId}/{size}`, with the example's
  element and microversion;
- the icon, `featurescript-icons/{elementId}/{microversionId}.svg`, written by
  the load that finds it and deleted by the load that orphans it.

**KV**: `featurescripts-load` — the run holding the load, a day as a backstop,
as `library-reload:` is for a library.

**Onshape**: the manifest, `featurescripts.json`, an image-and-file (blob)
tab at the top level of the frontend document, written by robot-code's release
alone; see [The manifest](#the-manifest).

**Webhooks**: one `onshape_webhooks` row, subject
`WebhookSubject.FEATURESCRIPTS`, subject id the frontend document's id.

**Configuration**: `FEATURESCRIPTS_DOCUMENT_ID`, the frontend document, in
`wrangler.jsonc`'s vars; the binding `LOAD_FEATURESCRIPTS_WORKFLOW`.

## Flows

### Releasing (robot-code)

`fs release` keeps the manifest whole, so the app pairs nothing by name and
reads one file for every feature:

1. `fs check` requires a released feature's Feature Type Name to be the name
   `feature_name_for` makes of its tab (`robotFrame.fs` → `Robot frame`), so
   the version names and the example's name agree with the feature's.
2. After pushing the frontend studio, the release looks for a Part Studio
   named `<Feature Type Name> example` in the frontend workspace, and creates
   an empty one beside the studio if there is none, saying so: "Created Robot
   frame example; model an example in it before publishing."
3. `--publish` refuses while that example was created by this same release,
   so an empty example is never published. `fs sync-versions` publishes it
   once it's modeled.
4. It writes the feature's icon, the `.svg` its `"Icon"` imports (`fs gen`'s
   output, e.g. `robotFrameIcon.svg`), to an image tab named
   `<Feature Type Name> icon.svg`, creating it on the first release and
   replacing its contents when the icon changed (`upload_image`). A feature
   with no `"Icon"` gets none.
5. It reads `featurescripts.json` from the frontend workspace, puts the
   feature's entry in it — replacing the one with the same `studioElementId`,
   or adding one — and writes it back, creating the tab on the first release.
   The entry's icon is the tab step 4 found or made, and its version the one
   this release is cutting, so the frontend version holds the manifest that
   describes it. The example isn't in it: the app finds it by name, so a Part
   Studio renamed by hand to `<Feature Type Name> example` is the example.
6. `fs deprecate` renames the example `DEPRECATED <Feature Type Name> example`
   and the icon `DEPRECATED <Feature Type Name> icon.svg` alongside its
   studio, and removes its entry from the manifest.

The API can't make or move folders, so a first release lands its studio at the
top level, under **Other**, until the owner files it into its category's
folder by hand, once.

### The manifest

`featurescripts.json`, at the top level of the frontend document, is the whole
contract between robot-code and the app: everything the app shows of a feature
but its category (a folder) and its example (a Part Studio found by name).
Written only
by `fs release` and `fs deprecate`; the app only reads it.

```json
{
    "schemaVersion": 1,
    "features": [
        {
            "studioElementId": "0f49cec93d41f796943a8662",
            "featureType": "robotFrame",
            "name": "Robot frame",
            "description": "Add tube, channel, angle, or extrusion along an edge, or extrude it from a point.",
            "version": "1.3.0",
            "iconElementId": "…",
            "sourceUrl": "https://github.com/robot-education/robot-code/blob/robotFrame/v1.3.0/featurescripts/released/frame/robotFrame.fs"
        }
    ]
}
```

| Field             | What it is                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion`   | Bumped by robot-code when a field's meaning changes; the app refuses one it doesn't know rather than guess               |
| `studioElementId` | The frontend Feature Studio's tab; what an entry is keyed by                                                             |
| `featureType`     | The constant `defineFeature` is exported as, read from the source                                                        |
| `name`            | The Feature Type Name                                                                                                    |
| `description`     | `"Feature Type Description"` with `CREDIT` cut off and each `<br>` a line break                                          |
| `version`         | The release's version, without the `v`                                                                                   |
| `iconElementId`   | The icon tab; null for a feature with no `"Icon"`                                                                        |
| `sourceUrl`       | The file at its release's tag (`release_tag`, e.g. `robotFrame/v1.3.0`), whose path is the studio's in `fs-studios.json` |

The tag is made when the release is final, after the manifest is written; the
url names it ahead, as `release_tag` names it the same way, so it works from
the moment the release is.

### Loading — `LoadFeatureScriptsWorkflow`

Started by the webhook for a new frontend version, and by the owner's
**Reload**. A version is final once it's in the frontend document, so a new
version loads at once, with no approval.

1. Claims the load, waiting while another run holds it, as a library reload
   does.
2. `document`, `version`: the document, and its latest version, the one to
   load.
3. Ends here when that version is the one loaded, unless forced.
4. `contents`: the version's tabs, for each tab's microversion and folder.
5. `manifest`: `findManifestTab`, then `GET /blobelements/d/{did}/v/{vid}/e/{eid}`,
   then `parseManifest`. A version without one, or with one that doesn't
   parse, fails the load and changes nothing.
6. Pairs each entry with its example: `findExample`, the Part Studio named
   `<Feature Type Name> example`, in any case, in this version.
7. Selects the entries that are new, whose studio's, example's or icon's
   microversion changed, whose example appeared or went, or that failed last
   time; every one when forced. An entry is the list: a Feature Studio the
   manifest doesn't name isn't shown.
8. Per selected entry, under the shared limiter:
    - `thumbnail-{element}`: the example's, stored by `uploadThumbnailsStep`
      under the example's element and microversion. No example skips the step:
      `NO_EXAMPLE`, and the popup shows the app's empty state in its place.
    - `icon-{element}`: the icon tab's SVG, stored in R2. No icon skips the
      step: `NO_ICON`, and the card shows the generic FeatureScript icon.
    - An entry naming a tab the version doesn't have is `LOAD_FAILED`.
9. `save`: every row in one batch — the loaded, the unchanged carried over
   with the manifest's fields and each category rewritten, the removed deleted
   — and the document row with its version and bumped `cache_version`. Then
   pushes `featurescripts-changed` to open clients.
10. `delete-stale-thumbnails`, and the icons no row names, never fatal.
11. `register-webhook`: `ensureWebhook` for the document.
12. Releases the load.

Steps retry as a library's do (`ONSHAPE_STEP_RETRIES`, `THUMBNAIL_RETRIES`). It
reads Onshape as the owner when the owner asked, and otherwise borrows the
owner's background session; no one else's.

### Browsing

1. **FeatureScripts** sits in the page picker under Utilities, offered
   everywhere: browsing needs no document. Its page has no library search row
   or insert location, and themes the app in `AppColor.FEATURESCRIPTS`.
2. The route reads `GET /api/featurescripts-version`, then
   `GET /api/featurescripts?v=`, which answers every feature in tab order with
   its problems, the same for every caller, so it is cached as a library is.
   The client leaves out the features the owner hid (`isHidden`) unless the
   owner is looking. A favorite of a hidden feature is kept, and left out of
   the list with it.
3. `FeatureScriptList` shows **Favorites** first, when the signed-in caller
   has any, then one section per category (`groupByCategory`), in the order
   the folders come in the document, and **Other** last for the features at
   its top level. Each section opens and closes on its own; one a new load
   adds starts open.
4. The search box, in the navbar's second row where a library's is, filters
   the list on the client, every word against the name and the description,
   which the rows don't show but the popup does: it is a few dozen features,
   not an index's worth.
   While searching, Favorites is left out, so each match shows once, in its
   category.
5. The heart on a row, its ⋯ menu, and the popup's favorites or unfavorites
   the feature, shown at once and put right by the refetch of
   `GET /api/featurescripts/favorites`. Signed out, there is no heart and no
   Favorites.
6. Each card shows the feature's icon inline before its name, at the size
   of a line of text. `/api/featurescripts/icon/:elementId` serves it from R2
   as `image/svg+xml`, immutable under its microversion, with
   `Content-Security-Policy: sandbox`, and the client shows it in an `<img>`,
   so nothing in it runs.
7. Each row's outlined **Add** adds the feature in one click, as below. Its
   ⋯ menu also opens the Feature Studio in the loaded version (**Get
   FeatureScript**), for anyone who would rather add it to their toolbar
   Onshape's own way, and its source on GitHub (**View code**).
8. To the owner, each row and the popup carry the status card
   (`FeatureScriptStatus`), in the admin card's sections: **Build checks**,
   **Settings** (**Visible to users**, which posts to the visibility route,
   and the release's **Version**) and **Usage**.
9. A click on the row opens the popup (`openFeatureScriptMenu`), sized and
   titled as the insert menu is: the example's large thumbnail as a hero
   image across the top (or, without an example, a `SectionNotice` with the
   theme's puzzle piece), then the whole description, and the
   footer. **Add to Part Studio** there closes the popup once sent, so the
   feature's dialog in Onshape is what shows.

### Adding a feature — `POST /api/featurescripts/:featureId/add`

1. Signed in; the body names the Part Studio (`targetPath`, a workspace).
2. Reads the feature and the loaded version.
3. Posts a `CustomFeature` to the Part Studio's features
   (`addPartStudioFeature`, under `retryInsert`, finished by
   `finishEvenIfDisconnected`): `featureType` the constant, `namespace`
   `d{did}::v{vid}::e{eid}::m{mvid}` of the Feature Studio in the loaded
   version, no parameters.
4. Answers with the new feature's id. The client sends Onshape's
   `openFeatureDialog` client message for it (`sendOpenFeatureMessage`, as an
   insert does for its derive), so the feature's dialog opens for its
   selections, and toasts that it was added.
5. In the background, records a `FEATURE_ADD` event (not built).

Standalone, where there is nothing to add to, no add is offered, as no insert
is. In an assembly the row's **Add**, the popup's **Add to Part Studio** and the
menu item are disabled, the buttons saying on hover that FeatureScripts can only
be added to Part Studios.

### Opening the example

**Open example** opens the example Part Studio in the loaded version, in a
new browser tab. It calls nothing.

### Feedback

A FeatureScript report is a source of the one feedback form
([feedback.md](./feedback.md)), as a part report is, posted to Discord by
`POST /api/feedback` with the same rate limit and diagnostics.

1. **Report an issue**, last in a row's ⋯ and right-click menu and in the
   popup's ⋯, opens the form (`openFeatureScriptReport`) titled **Report issue
   with** the feature, with the topic `FeedbackTopic.FEATURESCRIPTS` fixed.
2. It offers bug (a feature that won't add, or builds wrong, is one), feature
   request, kudos and other, as the app's topics do
   ([feedback.md](./feedback.md)). `suggestTitle` fills the
   title as for a part: "Bug: Robot frame".
3. The body carries `featureScript: { featureScriptId }`. The server reads the
   feature (`findReportedFeatureScript`), refusing one that isn't loaded, and
   the post names it with its version, links its Feature Studio in the loaded
   version, and links its source.
4. General feedback offers **FeatureScripts** as an area too, with an optional
   **FeatureScript** under it, for a report about one feature or none.
5. The post goes to `DiscordForum.FEATURESCRIPTS`, whose webhook secret is
   `DISCORD_FEATURESCRIPTS_WEBHOOK_URL`; unset, the topic refuses reports as
   any other does. The forum holds one topic and takes no errors, so a
   thread's one tag is its type's. A failed add's **Report** goes to the
   app's forum, as any error's does.

## Analytics

Adding a feature is not a use: it isn't a part, so it counts toward no
library's uses, users or part counts. It is its own event,
`EventType.FEATURE_ADD`, with `libraryId` null, as a version run is.

- **Columns**, decided in `logged-event.ts` beside `NOT_A_USE`:
  `featureType`, the feature's constant, and in the element columns its
  Feature Studio's path in the loaded version. `NOT_A_FEATURE_ADD` nulls
  `featureType` for every other event. `trackFeatureAdd` records one once
  Onshape accepted the feature. A report naming a FeatureScript is a `REPORT`
  event that sets `featureType` too, so reports can be counted per feature.
- **Reports** roll up into `daily_report_metrics` as every report does, under
  the FeatureScripts topic.
- **Rollups**, in `rollupWrites`: `daily_featurescript_metrics` (day, feature
  type → adds) and `daily_featurescript_users` (day, feature type, user), in
  `src/backend/features/analytics/schema.ts`, so distinct users
  per feature and in total come from rollups, never from scanning events.
  Keyed by feature type, which never changes for a released feature, so a
  feature's history survives its row being replaced.
- **The owner's card** reads them, and the favorites table, through
  `GET /api/featurescripts/stats`: each feature's adds, distinct users and
  favorites, all time.
- **Dashboard** (to come): a **FeatureScripts** section on the overview (adds and users
  over the range, against the previous season, and adds per day), and a
  **FeatureScripts** page with one row per feature: adds, users, the share of
  adds, and reports.

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
| The feedback form, `POST /api/feedback`                           | Sources general, part, error and crash               | A `FEATURESCRIPT` source, topic and forum, and `featureScript` beside `part` in the body            |

Favorites are the area's own, since a library's reference insertables and
carry a configuration a feature doesn't have; they reuse the library's heart
(`FavoriteIcon`, `UnfavoriteIcon`). Recents stay the library's: a list this
short has little use for them.

## Invariants

- A feature is added from the version loaded, never from a workspace, so
  what's added is what was released.
- The manifest is the list: a feature is shown only when the loaded version's
  manifest names it, with the name, type, description, version, source and
  icon it gives. The app never writes the manifest.
- An example is the Part Studio named `<Feature Type Name> example` in the
  **same version** as the Feature Studio, and an icon the tab the manifest
  names there.
- The credit line is never shown: robot-code cuts it before writing the
  description.
- An icon is only ever shown as an image, never inlined into the page.
- One load runs at a time, and only the run holding the load releases it.
- An example's thumbnail is stored under the example's element and
  microversion, and is live while a `featurescripts` row names it.
- A feature add is never a use: it writes no library rollup, and a use never
  writes a FeatureScripts rollup.
- A feature add is recorded once, in the background, after Onshape accepted
  it.
- A load reads Onshape as the owner, its own session or a borrowed one, and
  never as a library's team.
- A feature's category is the folder it is in, in the loaded version; nothing
  else sets it.
- Favorites are a person's own: every favorite route answers for the caller
  alone, and the list is never cached.
- Only the owner shows or hides a feature, and a load never writes
  `is_visible`, so a choice outlasts every reload. Hiding one bumps the cache
  version, so no cached list still shows it.

## Failure and recovery

| What goes wrong                                    | What happens                                    | What puts it right                                    |
| -------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| An example is renamed or deleted                   | `NO_EXAMPLE`; the popup shows the generic image | Name one `<Feature Type Name> example`, cut a version |
| An example is published empty                      | A blank thumbnail                               | Model it, cut a version                               |
| A release before icons has none in the frontend    | `NO_ICON`; the generic icon                     | Its next release writes it                            |
| A thumbnail or an icon fails past its retries      | `LOAD_FAILED` on that feature; the rest save    | **Reload**                                            |
| A version has no manifest, or one that won't parse | The load fails; the last version stays shown    | Release again; **Reload**                             |
| An entry names a tab the version lacks             | `LOAD_FAILED` on that feature                   | Release it again                                      |
| Onshape cancels or deactivates the webhook         | New versions don't load                         | The next **Reload** registers it                      |
| No owner session to borrow                         | A webhook's load fails                          | The owner opens the app                               |
| Onshape refuses the feature at its defaults        | The add fails, toasted                          | Unverified; see the open questions                    |

## Decisions

- **Its own area, on shared plumbing.** A library's tables, metrics and pages
  assume parts: configurations, admin teams, uses. FeatureScripts are measured
  and shown differently, so they get their own tables, event and pages, and the
  plumbing both need is made generic once rather than built twice.
- **New versions, not edits, and no approval.** The webhook listens for
  `onshape.model.lifecycle.createversion` rather than `changed`: a release is
  final only once its frontend version exists, and it was reviewed in
  robot-code before that. So a new version loads at once.
- **A manifest the release writes.** robot-code already knows everything the
  app shows: each feature's constant, name, description, version, file and
  the tabs it made. Writing that into the frontend document as it releases
  makes the version the app loads carry its own description, read in one call,
  where reading each studio's featurespecs and parsing versions from version
  names would take a call per feature. It lives in the document rather than
  on GitHub, so a version and the file describing it can't disagree.
- **Examples by name, not in the manifest.** The examples already modeled in
  the frontend document are kept by renaming them `<Feature Type Name>
example`; with an id in the manifest, each would need a release to record
  it, and a remade or swapped example another. A name is the one thing the
  owner sets by hand in Onshape, so it is what pairs them.
- **The version to the owner alone.** The panel shows users what a feature
  does, not which release is loaded; the owner checks it in the card.
- **The description, for now, without the credit, in the popup.** `"Feature
Type Description"` is already written for every released feature, and is
  what Onshape shows in its own tooltip. Its credit line is for Onshape's
  tooltip, where a feature sits among everyone's; in the app every feature has
  the same author. Rows show the name alone, so a list reads at a glance.
- **The icon in a tab of its own, made by release.** The icon lives in the
  backend document, behind the frontend studio's import, where reaching it
  would mean reading and parsing two studios' code. A tab the release writes,
  named in the manifest, is one call.
- **A thumbnail as the hero, an icon in the list.** A list of features reads
  by name, and the icon is what Onshape's own toolbar shows beside one; the
  example is what a feature does, worth the space only once one is chosen.
- **A menu holds what no button does.** Adding and favoriting each have a
  button on the row and in the popup, so their menus leave them out rather
  than offer the same action twice.
- **Feedback through the one form.** A FeatureScript report differs from a
  part's only in what it names, so it is a source of the same form and route,
  and is rate limited and counted with every other report.
- **Added at defaults, then opened.** The API can add a feature only whole,
  so it is added at its defaults, failing until its selections are made, and
  the client then opens its dialog with `openFeatureDialog`, which leaves the
  person where clicking the feature in Onshape's toolbar would.
- **Filtered on the client.** A few dozen features need no search index.
- **Categories from the document's folders.** The frontend document is what
  people browse in Onshape too, and its folders already sort it; reading them
  keeps one arrangement for both, with no list of categories to keep in step in
  either repo. Filing a new feature is a step by hand, since the API can't
  move tabs into folders.
- **The owner's controls in a card, not a menu.** A part's admin card already
  gathers what an editor can see and change about it behind one icon; the
  same shape keeps the switch, the version and the problems together, and
  out of a user's way.
- **Hiding keeps favorites.** A library's hide removes the part from everyone's
  favorites; a FeatureScript's leaves them, only left out of the list while
  hidden, so showing it again loses nothing. A new feature starts shown: a
  release is already reviewed in robot-code.
- **Favorites without a configuration or an order.** A feature has nothing to
  configure, and a list this short is ordered well enough by when each was
  favorited.
- **Opens aren't counted.** Only an add is recorded; counting how often a
  feature's popup is opened would need a call from the client for each,
  and can be added beside `FEATURE_ADD` if adds alone don't say enough.

## Open questions

Each wants a check from the testbench before building on it, and an entry in
[ONSHAPE.md](../ONSHAPE.md) once answered:

- Whether `POST /partstudios/.../features` accepts a custom feature with no
  parameters, filling its defaults, as it does for std features.
- That `GET /blobelements/...` answers a blob tab's file as uploaded, both
  the manifest's JSON and an icon's SVG.
- Whether adding a feature this way puts it in the document's or the user's
  toolbar.
- That `openFeatureDialog` opens a custom feature added at its defaults, as it
  does a derive.

_Last reviewed: 2026-11-12_
