# FeatureScripts

**Status: proposed.** This is the design for review; none of it is built yet.

## Purpose

A tab of the app, beside the libraries, that lists the released FeatureScripts
in the public frontend document (robot-code's `frontend` in `[tool.fs]`). It
shows each one with its icon, description and release version, opens it onto
its example Part Studio's thumbnail as a hero image, adds its feature to the
open Part Studio in one click, and takes feedback on it, as a part's
**Report an issue** does.

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

Planned. Names are proposals; files that don't exist yet are named from
`src/backend/` or `src/frontend/`, without it.

`features/featurescripts/routes.ts`

```text
GET    /api/featurescripts                   every shown feature, cached under the document's version
POST   /api/featurescripts/:featureId/add    adds it to the Part Studio in the body
POST   /api/featurescripts/reload            owner: loads the latest version now
GET    /api/featurescripts/icon/:elementId   a feature's icon from R2, by ?v=<microversion>
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
// Feature Studios to load, and Part Studios and blobs to pair with them, deprecated tabs dropped.
function splitTabs(contents: DocumentContents): {
    studios: Tab[];
    partStudios: Tab[];
    blobs: Tab[];
};
// "<Feature Type Name> example", in any case.
function findExample(featureName: string, partStudios: Tab[]): Tab | undefined;
// "<Feature Type Name> icon.svg", in any case.
function findIcon(featureName: string, blobs: Tab[]): Tab | undefined;
// From the newest frontend version named "<Feature Type Name> - v<semver>".
function findReleaseVersion(
    featureName: string,
    versions: OnshapeVersion[]
): string | undefined;
// "Feature Type Description" with robot-code's CREDIT ("<br><br>FeatureScript by
// Alex Kempen.") cut off the end, and every other <br> a line break.
function cleanDescription(description: string): string;
```

`lib/onshape/endpoints/feature-studios.ts`

```ts
function getFeatureSpecs(
    client: OnshapeApi,
    path: ElementPath
): Promise<OnshapeFeatureSpecsResponse>;
```

`lib/onshape/endpoints/blobs.ts`

```ts
function downloadBlob(client: OnshapeApi, path: ElementPath): Promise<Response>;
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
    /** Absent without an icon tab; the card shows the generic FeatureScript icon. */
    iconUrl?: string;
    exampleElementId?: string;
    /** Absent without an example. */
    thumbnailUrls?: ThumbnailUrls;
    /** Owner only. */
    problems?: FeatureScriptProblem[];
}

enum FeatureScriptProblem {
    NO_EXAMPLE = "no-example",
    NO_ICON = "no-icon",
    NOT_ONE_FEATURE = "not-one-feature",
    LOAD_FAILED = "load-failed"
}
```

Frontend, under `features/featurescripts/`:

- `queries.ts` — the list, the add mutation, and the owner's reload.
- `components/featurescript-card.tsx` — a row: the icon inline before the
  name, the release version, the description's first line, and a ⋯ menu with
  **Report an issue**.
- `components/featurescript-details.tsx` — what opens on a click: the
  example's thumbnail as a hero image across the top, the icon and name under
  it, the whole description, **Add to Part Studio**, **Open example** and
  **Report an issue**.
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
| `icon_element_id`         | The icon tab in the same version; null when there is none                              |
| `icon_microversion_id`    | Its microversion, which names its R2 object; null with it                              |
| `thumbnail_urls`          | As `insertables`'; null without an example                                             |
| `problems`                | `FeatureScriptProblem[]`                                                               |
| `sort_order`              | The tab order in the frontend document                                                 |

**R2**:

- the example's thumbnail, under the existing
  `thumbnails/default/{elementId}/{microversionId}/{size}`, with the example's
  element and microversion;
- the icon, `featurescript-icons/{elementId}/{microversionId}.svg`, written by
  the load that finds it and deleted by the load that orphans it.

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
4. It writes the feature's icon, the `.svg` its `"Icon"` imports (`fs gen`'s
   output, e.g. `robotFrameIcon.svg`), to an image tab named
   `<Feature Type Name> icon.svg` in the frontend workspace, creating it on
   the first release and replacing its contents when the icon changed
   (`upload_image`). A feature with no `"Icon"` gets none.
5. `fs deprecate` renames the example `DEPRECATED <Feature Type Name> example`
   and the icon `DEPRECATED <Feature Type Name> icon.svg` alongside its
   studio, so the app drops all three.

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
5. Selects the Feature Studios that are new, whose own, example's or icon's
   microversion changed, whose example or icon appeared or went, or that
   failed last time; every one when forced.
6. Per selected studio, under the shared limiter:
    - `featurespecs-{element}`: exactly one spec is expected; its
      `featureType`, `featureTypeName` and description are kept. None or
      several is `NOT_ONE_FEATURE`, and the feature is hidden.
    - `thumbnail-{element}`: the example's, stored by `uploadThumbnailsStep`
      under the example's element and microversion. No example skips the step:
      `NO_EXAMPLE`, and the details show the generic FeatureScript image.
    - `icon-{element}`: `GET /blobelements/d/{did}/v/{vid}/e/{eid}`, the
      icon tab's SVG, stored in R2. No icon tab skips the step: `NO_ICON`, and
      the card shows the generic FeatureScript icon.
7. `save`: every row in one batch — the loaded, the unchanged carried over
   with their release versions recomputed, the removed deleted — and the
   document row with its version and bumped `cache_version`. Then pushes
   `featurescripts-changed` to open clients.
8. `delete-stale-thumbnails`, and the icons no row names, never fatal.
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
4. Each card shows the feature's icon inline before its name, at the size
   of a line of text. `/api/featurescripts/icon/:elementId` serves it from R2
   as `image/svg+xml`, immutable under its microversion, with
   `Content-Security-Policy: sandbox`, and the client shows it in an `<img>`,
   so nothing in it runs.
5. A click opens the details at `/app/featurescripts/<featureId>`: the
   example's large thumbnail as a hero image across the top, then the icon
   and name, the release version, the whole description, and the buttons.

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

### Feedback

A FeatureScript report is a source of the one feedback form
([feedback.md](./feedback.md)), as a part report is, posted to Discord by
`POST /api/feedback` with the same rate limit and diagnostics.

1. **Report an issue**, in a card's ⋯ menu and in the details, opens the form
   titled **Report issue with** the feature, with the topic
   `FeedbackTopic.FEATURESCRIPTS` fixed.
2. It offers bug (a feature that won't add, or builds wrong, is one), feature
   request, unclear description, kudos and other. `suggestTitle` fills the
   title as for a part: "Bug: Robot frame".
3. The body carries `featureScript: { featureScriptId }`. The server reads the
   feature (`findReportedFeatureScript`) and the post names it, its release
   version, and links to its Feature Studio and its example in the loaded
   version.
4. General feedback offers **FeatureScripts** among its topics too, for one
   that isn't about any one feature.
5. The post goes to `DiscordForum.FEATURESCRIPTS`, whose webhook secret is
   `DISCORD_FEATURESCRIPTS_WEBHOOK_URL`; unset, the topic refuses reports as
   any other does. Its tags are the topic's, the category's, and
   `unclear-description` for that category.

## Analytics

Adding a feature is not a use: it isn't a part, so it counts toward no
library's uses, users or part counts. It is its own event,
`EventType.FEATURE_ADD`, with `libraryId` null, as a version run is.

- **Columns**, decided in `logged-event.ts` beside `NOT_A_USE`:
  `featureScriptId`, `featureType`, `featureReleaseVersion`, `source`, and the
  target Part Studio's `documentId`, `instanceId` and `elementId`.
  `NOT_A_FEATURE_ADD` nulls them for every other event. A FeatureScript
  report is a `REPORT` event that sets `featureType` too, so reports can be
  counted per feature.
- **Reports** roll up into `daily_report_metrics` as every report does, under
  the FeatureScripts topic.
- **Rollups**, in `rollupWrites`: `daily_feature_adds` (day, feature type →
  adds) and `daily_feature_users` (day, feature type, user), so distinct users
  per feature and in total come from rollups, never from scanning events.
  Keyed by feature type, which never changes for a released feature, so a
  feature's history survives its row being replaced.
- **Dashboard**: a **FeatureScripts** section on the overview (adds and users
  over the range, against the previous season, and adds per day), and a
  **FeatureScripts** page with one row per feature: adds, users, the share of
  adds, reports, and its release version.

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

Favorites and recents stay the library's: their rows reference insertables,
and a list this short has little use for either.

## Invariants

- A feature is added from the version loaded, never from a workspace, so
  what's added is what was released.
- An example is the Part Studio in the **same version** as its Feature
  Studio, paired only by name.
- A feature's name, type and description come from its featurespecs, never
  from its tab name. Its icon and example are paired with it by that name, in
  the same version.
- The credit line is never shown: `cleanDescription` cuts it before the
  description is stored.
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

## Failure and recovery

| What goes wrong                                     | What happens                                     | What puts it right                 |
| --------------------------------------------------- | ------------------------------------------------ | ---------------------------------- |
| An example is renamed or deleted                    | `NO_EXAMPLE`; the details show the generic image | Rename it back, cut a version      |
| An example is published empty                       | A blank thumbnail                                | Model it, cut a version            |
| A release before icons has none in the frontend     | `NO_ICON`; the generic icon                      | Its next release writes it         |
| Featurespecs or a thumbnail fail past their retries | `LOAD_FAILED` on that feature; the rest save     | **Reload**                         |
| Onshape cancels or deactivates the webhook          | New versions don't load                          | The next **Reload** registers it   |
| No owner session to borrow                          | A webhook's load fails                           | The owner opens the app            |
| Onshape refuses the feature at its defaults         | The add fails, toasted                           | Unverified; see the open questions |

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
- **The description, for now, without the credit.** `"Feature Type
Description"` is already written for every released feature, and is what
  Onshape shows in its own tooltip. Its credit line is for Onshape's tooltip,
  where a feature sits among everyone's; in the app every feature has the
  same author, so it would repeat on every card.
- **The icon in a tab of its own, made by release.** The icon lives in the
  backend document, behind the frontend studio's import, where reaching it
  would mean reading and parsing two studios' code. A tab named like the
  example, written by the release, is one more pairing by name and one call.
  If featurespecs turns out to carry the icon, the tab isn't needed.
- **A thumbnail as the hero, an icon in the list.** A list of features reads
  by name, and the icon is what Onshape's own toolbar shows beside one; the
  example is what a feature does, worth the space only once one is chosen.
- **Feedback through the one form.** A FeatureScript report differs from a
  part's only in what it names, so it is a source of the same form and route,
  and is rate limited and counted with every other report.
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
  would make the icon tab unnecessary.
- That `GET /blobelements/...` of an image tab answers the file as uploaded.
- Whether adding a feature this way puts it in the document's or the user's
  toolbar.

_Last reviewed: 2026-11-11_
