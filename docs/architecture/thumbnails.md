# Thumbnails

## Purpose

Every picture of a part the app shows is served from our own R2 bucket, never
from Onshape per page view: Onshape renders slowly, and each fetch spends the
account's API allocation. There are three kinds:

- **Insertable thumbnails** — an insertable in its default configuration,
  stored by the load.
- **Group thumbnails** — the document's thumbnail tab, stored by the load.
- **Configuration thumbnails** — one configuration of an insertable, rendered on
  demand the first time someone picks it.

## Code map

| Path                                                        | Role                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/backend/features/thumbnails/keys.ts`                   | R2 keys and app urls; shared with the client so both build the same url     |
| `src/backend/features/thumbnails/store.ts`                  | `putThumbnail`, `uploadThumbnails` (both sizes of an insertable's default)  |
| `src/backend/features/thumbnails/routes.ts`                 | Serving stored thumbnails, starting a render, **Reload thumbnail**          |
| `src/backend/features/thumbnails/render.ts`                 | `requestRender`: starts one configuration's render, at most once            |
| `src/backend/features/thumbnails/render-workflow.ts`        | `RenderThumbnailWorkflow`: waits out Onshape's render and stores both sizes |
| `src/backend/features/thumbnails/reload.ts`                 | The **Reload thumbnail** action for one insertable or group                 |
| `src/backend/features/thumbnails/reconcile.ts`              | `deleteStaleThumbnails`: removes objects nothing points at                  |
| `src/backend/lib/onshape/endpoints/thumbnails.ts`           | Onshape calls: element thumbnail, thumbnail id, thumbnail by id             |
| `src/frontend/features/thumbnails/components/thumbnail.tsx` | `CardThumbnail` (rows) and `PreviewImageCard` (insert menu)                 |
| `src/frontend/features/thumbnails/render-wait.ts`           | `loadRenderedImage`: starts a render on a miss, waits for its push          |

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
`groups` hold the app urls of the default thumbnails.

## Flows

### Insertable and group thumbnails, during a load

1. `loadInsertable` (see [loading.md](./loading.md)) calls `uploadThumbnails` for
   the insertable's tab, keyed by the version's microversion. A part studio with
   no parts is skipped.
2. `uploadThumbnails` fetches each size that is not already stored, from the
   version first and the document's own workspace when the version won't give
   one up, and throws when neither does.
3. The step runs under its own limiter (`THUMBNAIL_CONCURRENCY`) with
   `THUMBNAIL_RETRIES` (`src/backend/features/load/steps.ts`): three retries,
   10, 20 and 40 seconds apart. Exhausted, it records `THUMBNAIL_FAILED` and the
   load carries on.
4. The group's thumbnail comes from the document's designated thumbnail tab, or
   its first tab without one (`NO_THUMBNAIL_TAB`).

### Serving

`GET /api/thumbnail/:size/:elementId?v={microversionId}&configurationKey=` only
serves what is stored:

- **Hit**: streamed from R2, cacheable for a year.
- **Miss**: 404, uncached, so a render landing later is not shadowed. A
  configuration miss is never answered with the insertable's default.

### Rendering a configuration

A render is started explicitly, by a client that got a configuration miss and
can wait for it: the insert menu's preview and favorite rows. Search rows never
start one, so a cold search cannot start a render per row.

1. The client calls `POST /api/render-thumbnail/insertable/:insertableId` with
   the selection as entered. It must be signed in: the render calls Onshape as
   the caller.
2. `requestRender` makes the selection whole against the insertable's
   parameters and derives its key itself, so a caller can't store one
   configuration's picture under another's key. The element's default is
   refused with a 400.
3. It asks the insertables endpoint, on the insertable's version, for the
   configuration's `predictableThumbnailId`, sending `renderOverrides`: the
   values as entered, escaped once (`encodeQueryConfiguration`). No insertables
   answers `no-part`, which the client shows as a configuration that failed to
   regenerate; otherwise it answers `rendering`.
4. The instance id is `version-render-` plus a SHA-256 of
   `elementId/microversionId/configurationKey`, so every request for one render
   finds the same instance. A running instance is left alone; a finished one is
   restarted, and returns at once if its bytes are already stored.
5. `RenderThumbnailWorkflow` fetches the sizes by thumbnail id one at a time,
   the preview's first: the first ask starts Onshape's render and it answers 404
   until done, and asking for another meanwhile abandons it. Each size is retried
   every two seconds for about a minute (`RENDER_RETRIES`), and stored as it
   lands.
6. Each stored size pushes a `thumbnail` message (`src/backend/features/push/`).

On the client, `loadRenderedImage` fetches; on the first miss it starts the
render and fetches again at once, then waits for the push (or its 60-second
deadline) before fetching once more. The row shows the insertable's default
meanwhile.

### Reload thumbnail

Editors can refetch one insertable's or group's thumbnail from its menu
(`POST /api/reload-thumbnail/library/:libraryId`, naming the group or insertable
in the body). It deletes the stored pair, fetches again as a load does (the
version, then the document's workspace), clears `THUMBNAIL_FAILED` and bumps
the library version. Onshape still rendering answers 503.

### Cleanup

`deleteStaleThumbnails` runs after each load saves its group, and when a group
is deleted. For each element of the document, past and present, it lists both
prefixes and deletes objects whose `(elementId, microversionId)` no insertable
row in **any** library names and no group thumbnail url points at. A forced
reload also deletes every configuration render of the document
(`dropRenders`), so bad ones are redone.

### Onshape calls

| Flow            | Call                                                                                                | Retries                             |
| --------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Load, reload    | `GET /thumbnails/d/{did}/v/{vid}/e/{eid}/s/{size}`, then `/w/{wid}/` on failure, per size           | `THUMBNAIL_RETRIES`; none on reload |
| Render request  | `GET /documents/d/{did}/v/{vid}/insertables?elementId=&configuration=` for `predictableThumbnailId` | none: the route answers             |
| Render workflow | `GET /thumbnails/{thumbnailId}/s/{size}`, one size at a time                                        | `RENDER_RETRIES`                    |

A render workflow calls Onshape as the session that requested it
(`getOnshapeApiFromSessionId`), so a render outlives the request but not a
revoked session.

### Retries, timeouts and toasts

Every limit a thumbnail meets on its way to the screen, in the order it meets
them. Shared policies are in [platform.md](./platform.md#retries-and-timeouts).

**Onshape client** (`src/backend/lib/onshape/client.ts`), under every call
below:

- Each request aborts after 60 s (`REQUEST_TIMEOUT_MS`).
- No retry of its own. A 429 throws `OnshapeRateLimitError` carrying
  `Retry-After`, or 60 s when Onshape sends none (`DEFAULT_RETRY_AFTER_SECONDS`).

**Load, default thumbnails** (`uploadThumbnailsStep`, `src/backend/features/load/steps.ts`):

| Setting                 | Policy                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------- |
| One attempt             | Each size not stored: the version, then the document's workspace on any failure    |
| `THUMBNAIL_RETRIES`     | 3 retries after 10, 20 and 40 s; a 429 waits `Retry-After` plus 0–20 s of jitter   |
| `THUMBNAIL_CONCURRENCY` | 10 thumbnail steps at once, apart from probing; a slot is held through the retries |
| Exhausted               | No urls, `THUMBNAIL_FAILED` on the insertable or group; the load carries on        |

**Reload thumbnail** (`reload.ts`, `useReloadThumbnailMutation`):

- One attempt per size, version then workspace, no retry. Onshape not having
  one answers a handled 503.
- Toasts share the id `reload-thumbnail`: "Reloading thumbnail..." stays until
  the answer, then "Thumbnail reloaded." or the 503's message ("Onshape has not
  rendered this thumbnail yet. Try again in a few minutes."), falling back to
  "Failed to reload thumbnail. Onshape may not have one yet."

**Serving** (`GET /api/thumbnail/...`): a hit is cached immutably for a year; a
miss is a 404 marked not to be cached.

**Configuration render, server side:**

| Setting                      | Policy                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `POST /api/render-thumbnail` | One insertables call, no retry; an Onshape failure fails the request                                    |
| `RENDER_RETRIES`             | Per size, large then small: 30 retries every 2 s, about a minute; a 429 waits `Retry-After` plus jitter |
| Exhausted                    | The instance errors with nothing stored; asking again restarts it                                       |
| Instances                    | One per key (`version-render-…`); a running one is left alone, a finished one restarted                 |

**Configuration render, client side** (`loadRenderedImage`, `render-wait.ts`):

1. Fetch the stored url. On a miss, start the render once and fetch again at
   once.
2. Then fetch again on each matching `thumbnail` push, and once more at the
   deadline, 60 s after the first fetch (`RENDER_TIMEOUT_MS`).
3. Still missing at the deadline: the query errors and is not retried
   (`retry: false`). The preview shows "The thumbnail could not be loaded.";
   a row keeps showing the insertable's default. `no-part` errors at once
   ("Part failed to regenerate."). Picking the configuration again starts over.

**Stored thumbnails on the client** (`Thumbnail`, `thumbnail.tsx`): a row's
image and its fallback retry once (`STORED_RETRIES`, TanStack's default delay of
1 s). A row that can't start a render but errored is refetched when a matching
`thumbnail` push arrives (`usePushSync`).

**Pushes** (`push-socket.ts`): a dropped socket reconnects after 1 s, doubling
to 30 s. A push missed meanwhile is lost, which the render wait's deadline
fetch covers.

**Tips** (`insert-tips.ts`, `showTipToast`): after 15 s of a render in the
insert menu (`THUMBNAIL_WAIT_MS`), and only inside Onshape, "Tip: you can insert
a part even while the part's thumbnail is still generating." It closes after
8 s (`TIP_AUTO_CLOSE_MS`) and is restarted by each new configuration.

## Invariants

- A stored object is never overwritten: its key contains the microversion, so a
  changed element lands on new keys.
- A configuration url never serves the insertable's default, and a miss is never
  cached.
- Serving never starts a render; only `POST /api/render-thumbnail/...` does, for
  a signed-in caller, and at most one instance runs per key.
- Configuration renders are resolved and fetched on the version. Element and
  group thumbnails are read from the version, and from the document's own
  workspace only when the version won't give one up.
- A render workflow asks Onshape for one size at a time.
- Configuration thumbnails are named by `ConfigurationKey`, and keys are used for
  nothing else (see [configurations.md](./configurations.md)).
- Cleanup keeps anything younger than `STALE_THUMBNAIL_GRACE_MS` (one hour): a
  load stores thumbnails before the rows naming them.

## Failure and recovery

| Failure                                             | Result                                        | Recovery                                                      |
| --------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| Neither instance gives up an insertable's thumbnail | `THUMBNAIL_FAILED` on the insertable or group | **Reload thumbnail**, or the next version's load              |
| A configuration never renders within ~1 min         | Client keeps showing the default              | Picking it again restarts the finished instance               |
| A bad configuration render was stored               | Wrong picture, immutably cached               | Owner's **Reload all documents** drops the document's renders |
| A load crashes between storing and saving           | Orphaned objects                              | Next cleanup, after the grace period                          |

## Decisions

- **The version, falling back to the document's workspace.** The version is
  what the library shows, but Onshape's version form of the element thumbnail
  endpoint is unreliable and its workspace form isn't. Stored under the
  version's microversion either way, since that is what the rows hold.
- **Renders by thumbnail id, on the version.** The id insertables reports for a
  configuration is fetched through `/thumbnails/{id}`, whose first ask starts
  the render. The documented configured-thumbnail endpoint (`/ac/`) returned
  the default image, and in a workspace insertables reports one id for every
  configuration.
- **One size at a time, in a workflow per configuration.** Asking Onshape for a
  second render abandons the first (observed, not documented), so a workflow
  never asks for both sizes at once. Two configurations rendering for one user
  at the same moment can still disturb each other; the insert menu renders one
  at a time.
- **No R2 lifecycle rule.** Renders are meant to last; cleanup deletes what is
  orphaned instead of expiring what might still be shown.

_Last reviewed: 2026-10-04_
