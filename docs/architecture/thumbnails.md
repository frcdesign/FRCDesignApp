# Thumbnails

## Purpose

Every picture of a part the app shows is served from our own R2 bucket, never
from Onshape per page view: Onshape renders slowly, and each fetch spends the
account's API allocation. There are three kinds:

- **Element thumbnails** — an insertable's default configuration, stored by the
  load.
- **Group thumbnails** — the document's thumbnail tab, stored by the load.
- **Configuration thumbnails** — one configuration of an insertable, rendered on
  demand the first time someone picks it.

## Code map

| Path                                                        | Role                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/backend/features/thumbnails/keys.ts`                   | R2 keys and app urls; shared with the client so both build the same url     |
| `src/backend/features/thumbnails/store.ts`                  | `putThumbnail`, `uploadThumbnails` (both sizes of an element's default)     |
| `src/backend/features/thumbnails/workspace.ts`              | The per-version thumbnail workspace: `syncThumbnailWorkspace`, cleanup      |
| `src/backend/features/thumbnails/routes.ts`                 | `GET /api/thumbnail/...`, `POST /api/reload-thumbnail`                      |
| `src/backend/features/thumbnails/render.ts`                 | `requestRender`: starts one configuration's render, at most once            |
| `src/backend/features/thumbnails/render-workflow.ts`        | `RenderThumbnailWorkflow`: waits out Onshape's render and stores both sizes |
| `src/backend/features/thumbnails/reload.ts`                 | The **Reload thumbnail** action for one element or group                    |
| `src/backend/features/thumbnails/reconcile.ts`              | `deleteStaleThumbnails`: removes objects nothing points at                  |
| `src/backend/lib/onshape/endpoints/thumbnails.ts`           | Onshape calls: element thumbnail, thumbnail id, thumbnail by id             |
| `src/frontend/features/thumbnails/components/thumbnail.tsx` | `CardThumbnail` (rows) and `PreviewImageCard` (insert menu)                 |
| `src/frontend/features/thumbnails/render-wait.ts`           | `loadRenderedImage`: waits for a render's push, then fetches                |

## Storage

**R2 (`BLOB`)**, under `thumbnails/`:

```
thumbnails/default/{elementId}/{microversionId}/{size}
thumbnails/config/{elementId}/{microversionId}/{encodeURIComponent(configurationKey)}/{size}
```

Each object carries `microversionId` and `configurationKey` as custom metadata,
and is stored with an immutable one-year cache header. Nothing expires on a
timer; see cleanup below.

**D1**: `insertables.small_thumbnail_url` / `large_thumbnail_url` and the same on
`groups` hold the app urls of the default thumbnails. `groups.thumbnail_workspace_id`
records the group's thumbnail workspace.

**Onshape**: one workspace per document version named
`FRCDesignApp Thumbnails (DO NOT EDIT)`, whose description names the version.

## Flows

### The thumbnail workspace

Onshape sometimes never renders thumbnails in a version, and the document's own
workspace moves on from the version we loaded. So every thumbnail is read from a
workspace of ours branched off the loaded version.

1. A load of a new version calls `syncThumbnailWorkspace`, which finds our
   workspace whose description names that version, or branches one. Every group
   of the document and every retried step find the same one.
2. The group row records it (`thumbnail_workspace_id`).
3. After the group saves, `deleteStaleThumbnailWorkspaces` deletes every other
   workspace of ours, so the document keeps exactly one.

A fresh branch has no rendered thumbnails for a few minutes.

### Element and group thumbnails, during a load

1. `loadInsertable` (see [loading.md](./loading.md)) calls `uploadThumbnails` for
   the element in the thumbnail workspace, keyed by the **version's**
   microversion. A part studio with no parts is skipped.
2. `uploadThumbnails` fetches each size that is not already stored and throws
   while Onshape has not rendered it.
3. The step runs under its own limiter (`THUMBNAIL_CONCURRENCY`) with
   `THUMBNAIL_RETRIES` (`src/backend/features/load/steps.ts`): retry after one
   minute, then every two, about 17 minutes in all. Exhausted, it records
   `THUMBNAIL_FAILED` and the load carries on.
4. The group's thumbnail comes from the document's designated thumbnail tab, or
   its first tab without one (`NO_THUMBNAIL_TAB`).

### Serving

`GET /api/thumbnail/:size/:elementId?v={microversionId}&configurationKey=&insertableId=`

- **Hit**: streamed from R2, cacheable for a year.
- **Miss**: 404, uncached, so a render landing later is not shadowed. A
  configuration miss is never answered with the element's default.
- **Configuration miss with `insertableId`, signed in**: also calls
  `requestRender`. Only the insert menu and favorite rows pass `insertableId`;
  search rows do not, so a cold search cannot start a render per row.

### Rendering a configuration

1. `requestRender` reads the group's thumbnail workspace. A group without one
   starts nothing (it gets one on its next load).
2. It asks Onshape for the configuration's thumbnail id through the insertables
   endpoint, in the workspace. No part for the configuration answers **422**,
   which the client shows as a configuration that failed to regenerate.
3. The instance id is `render-` plus a SHA-256 of
   `elementId/microversionId/configurationKey`, so every miss for one render
   finds the same instance. A running instance is left alone; a finished one
   left no bytes behind, so it is restarted.
4. `RenderThumbnailWorkflow` fetches both sizes by thumbnail id, each retried
   every five seconds for about a minute (`RENDER_RETRIES`), and stores each as
   it lands.
5. Each stored size pushes a `thumbnail` message (`src/backend/features/push/`).

On the client, `loadRenderedImage` fetches, and on a miss waits for that push
(or its 60-second deadline) before fetching once more. The row shows the
element's default meanwhile.

### Reload thumbnail

Editors can refetch one element's or group's thumbnail from its menu
(`POST /api/reload-thumbnail`). It deletes the stored pair, fetches again from
the thumbnail workspace (syncing it first), clears `THUMBNAIL_FAILED` and bumps
the library version. Onshape still rendering answers 503.

### Cleanup

`deleteStaleThumbnails` runs after each load saves its group, and when a group
is deleted. For each element of the document, past and present, it lists both
prefixes and deletes objects whose `(elementId, microversionId)` no insertable
row in **any** library names and no group thumbnail url points at. A forced
reload also deletes every configuration render of the document
(`dropRenders`), so bad ones are redone.

## Invariants

- A stored object is never overwritten: its key contains the microversion, so a
  changed element lands on new keys.
- A configuration url never serves the element's default, and a miss is never
  cached.
- A configuration render starts only for a signed-in caller who picked the
  configuration (`insertableId` present), and at most one instance runs per key.
- Thumbnails are read from the thumbnail workspace only, never from the version
  or the document's own workspace.
- Configuration thumbnails are named by `ConfigurationKey`, and keys are used for
  nothing else (see [configurations.md](./configurations.md)).
- Cleanup keeps anything younger than `STALE_THUMBNAIL_GRACE_MS` (one hour): a
  load stores thumbnails before the rows naming them.

## Failure and recovery

| Failure                                         | Result                                     | Recovery                                                      |
| ----------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| Onshape never renders an element within ~17 min | `THUMBNAIL_FAILED` on the element or group | **Reload thumbnail**, or the next version's load              |
| A configuration never renders within ~1 min     | Client keeps showing the default           | Picking it again restarts the finished instance               |
| A bad configuration render was stored           | Wrong picture, immutably cached            | Owner's **Reload all documents** drops the document's renders |
| A load crashes between storing and saving       | Orphaned objects                           | Next cleanup, after the grace period                          |

## Decisions

- **A workspace per version, not the version.** Onshape does not reliably render
  thumbnails in versions. Branching per version, rather than reusing one
  workspace, keeps the rendered content identical to what was loaded.
- **Keyed by the version's microversion though read from the workspace.** The
  workspace is branched from that version, so its content renders the same, and
  the version's microversion is what the rows already hold.
- **Renders by thumbnail id.** The id Onshape reports for an insertable in a
  configuration is fetched through `/thumbnails/{id}`; the documented
  configured-thumbnail endpoint and its strictness flags returned wrong or
  default images.
- **No R2 lifecycle rule.** Renders are meant to last; cleanup deletes what is
  orphaned instead of expiring what might still be shown.

_Last reviewed: 2026-09-27_
