# Version manager

## Purpose

Linking Onshape workspaces to one another and moving external references along
those links: **pushing** a version of the workspace the app was launched in out
to the workspaces that reference it, and **pulling** the workspaces it
references onto their latest versions.

It is not part of a library. It acts on whatever document Onshape launched the
app from, under the caller's own Onshape permissions, and the library's access
levels have no say over it.

## Terms

From the workspace the panel is open in:

- A **parent** is a workspace this one references. You **pull** from it.
- A **child** is a workspace that references this one. You **push** to it.

A change starts in a parent and flows down to its children. This is the opposite
of an assembly tree's sense, where the assembly is the parent of the parts in
it.

## Code map

| Path                                                                            | Role                                                                             |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/backend/features/version-manager/contract.ts`                              | `WorkspacePath`, `LinkDirection`, the scopes, `VersionJobStatus`, `workspaceKey` |
| `src/backend/features/version-manager/schema.ts`                                | `workspace_links`, the feature's own table                                       |
| `src/backend/features/version-manager/links.ts`                                 | The D1 reads and writes, and resolving a row into what the client shows          |
| `src/backend/features/version-manager/graph.ts`                                 | Pure: the order a push runs in, and cycle detection                              |
| `src/backend/features/version-manager/references.ts`                            | The reference-update engine both a push and a pull run                           |
| `src/backend/features/version-manager/workflow.ts`                              | `VersionManagerWorkflow`, one class over a push or a pull                        |
| `src/backend/features/version-manager/jobs.ts`                                  | The run a workspace last started, and its status                                 |
| `src/backend/features/version-manager/workspace-cache.ts`                       | A linked workspace's names and pending-change count, cached                      |
| `src/backend/features/version-manager/routes.ts`                                | Every route below                                                                |
| `src/frontend/features/version-manager/queries.ts`                              | The queries and mutations                                                        |
| `src/frontend/features/version-manager/components/linked-workspace-section.tsx` | A direction's list, its rows, and everything they can run                        |
| `src/frontend/routes/app/version-manager.tsx`                                   | The page: two sections, one per direction                                        |

## Storage

**D1** `workspace_links`: `id`, `source_document_id`, `source_workspace_id`,
`target_document_id`, `target_workspace_id`, `created_at`. One row per edge, the
source being the parent and the target the child. Unique across the four ids,
with an index on each end so a lookup in either direction scans neither. It
holds no foreign key into the rest of the schema: a link is between two Onshape
workspaces, neither of which need be in any library.

**KV** `version-job:{documentId}|{instanceId}` — the workflow instance a
workspace last started, for six hours. A pointer only; the run's status is read
off the instance.

**KV** `linked-workspace:{documentId}|{instanceId}` — a linked workspace's
document and workspace names, for a week.

**KV** `linked-workspace-changes:{documentId}|{instanceId}` — its
`changesSinceVersionSave`, for an hour.

**Browser** `isParentsOpen`, `isChildrenOpen`, `quickActionTipCount` in
`uiState`.

## Flows

### Showing the page

The tab appears only when Onshape launched the app in a workspace
(`useTargetWorkspace`); `beforeLoad` redirects anyone who reaches the url
without one.

`GET /api/workspace-links` answers `{ parents, children }`. For each row it asks
Onshape whether the caller may read the far end, and — from the cache — what it
is called. A workspace the caller cannot read comes back `isOpenable: false` and
unnamed: they are shown that a link exists, not what it points at.

`GET /api/unversioned-changes` answers, per link id, how far each parent has
moved since its own last version (`changesSinceVersionSave` on the insertables
response, asked with no `include` flags so Onshape enumerates nothing). A pull
moves onto a version, so these are the edits it cannot bring in, and the row
shows the count as a badge.

### Linking

`POST /api/workspace-links` takes the url somebody pasted, already parsed to a
workspace by `parseOnshapeWorkspace`. Only a workspace will do: a version cannot
be written to, and a url that stops at the document is refused rather than
resolved to the default workspace, which would be a different one than whoever
copied the link was looking at.

`POST /api/workspace-link/:linkId/move` turns a link around, for one filed the
wrong way up. It rewrites the row rather than deleting and re-adding it. Where
the reversed edge already exists — a pair that links both ways — it drops this
row instead, the unique index over the four ids allowing only one.

`DELETE /api/workspace-link/:linkId` needs write on **either** end: a link
belongs to both workspaces.

### Pushing

`POST /api/push-version` resolves what the push reaches into an ordered list of
steps, checks permissions across all of them, starts the workflow and answers
its `jobId`.

1. **Direct** (the default, `PushScopeKind.CHILDREN` or `ONE`): a version of
   this workspace, then each child's references moved onto it. The children are
   left un-versioned, so their owners decide when to cut one.
2. **Recursive** (`DESCENDANTS`, or `ONE` with `recursive`): the whole closure
   below this workspace in topological order, cutting a version of each as it
   passes. A workspace two hops out can only pick the change up from a version
   of the workspace between them, so there has to be one. Two parents feeding
   one workspace is why the order is topological rather than breadth-first: it
   must be updated once, after both have versions. A cycle fails the run before
   it starts (`LinkCycleError`).

Permissions are checked for every workspace in the order before the first
version is cut: write and link on this workspace, write on each one the run
writes to, and link on each one it versions. A push that cut a version and then
found it could not finish would have already changed the document it was called
on.

### Pulling

`POST /api/pull-references` moves this workspace's references onto the latest
version of each document it names. `PARENTS` restricts that to the linked
parents, `ONE` to a single parent, and `ALL` takes every out-of-date reference,
linked or not — which is the one thing the parent list cannot express.

There is no recursive pull. Going further would mean versioning a parent's own
parents, which is a push, and theirs to make.

### Updating references

`references.ts` is what both run. `planReferenceUpdates` is pure: it turns
Onshape's `externalreferences` response into the updates to post, grouped by
tab. `updateOutdatedReferences` reads the references, posts each tab's updates
and returns the counts.

Two departures from the app this was ported from:

- Where a push has pinned a version for a document, a reference is updated
  whenever its instance id differs from the pinned one, rather than when Onshape
  flags it `isOutOfDate`. The push cut that version moments earlier, and the
  flag is not something to race.
- A tab Onshape refuses to update is counted and passed, not swallowed. A push
  that only half landed should not read as a success.

Tabs are updated one at a time. The port's comment says doing them concurrently
caused problems and does not say why, so this follows it rather than finding out
in somebody's document.

### Watching a run

The route pushes `RUNNING` as it starts the workflow, and the workflow pushes
the result when it ends, over the socket in [platform.md](./platform.md). The
client asks `GET /api/version-job` once when the page opens and again after a
reconnect; nothing polls. A client's socket is tagged with the workspace it was
launched in as well as its library, so a run reaches the people in that document
and nobody else.

While a run is going, the button that started it carries the spinner. What it
did — how many tabs moved, and whether any would not — arrives as one toast at
the end.

### Keeping a linked workspace current

The first read of a linked workspace registers a transient webhook on it for
`onshape.model.lifecycle.changed`, `.metadata` and `.createversion`. A delivery
drops both cached entries, so the next panel to open asks Onshape again. Onshape
deletes a transient webhook that goes quiet, so the entries expire as well.

## Invariants

- A link is stored once, as one row. Both directions are read off it.
- Only a workspace is ever linked, pushed to or pulled into. A version is a
  snapshot with no references to update, and a microversion cannot be written to.
- Onshape decides what may be done, not the app's access levels. Every route
  checks the caller's Onshape permissions on the documents it would touch.
- A push checks every workspace it would write to before it cuts anything.
- A recursive push versions every workspace it passes through, in topological
  order.
- Nothing about a workspace the caller cannot read reaches them: no name, and no
  thumbnail.
- Permissions are never cached; names and change counts are.

## Failure and recovery

| Failure                                  | Result                                       | Recovery                                           |
| ---------------------------------------- | -------------------------------------------- | -------------------------------------------------- |
| A linked document is unshared or deleted | The row shows "Missing access" and no name   | Remove the link                                    |
| The caller cannot write to a child       | The push is refused before it starts         | The child's owner shares write access              |
| Onshape rate-limits the run              | The step waits its `Retry-After` and resumes | None needed                                        |
| A tab refuses its update                 | Counted as failed, the run carries on        | The toast says how many; run it again              |
| The links form a cycle                   | A recursive push is refused                  | Remove a link                                      |
| A webhook Onshape dropped                | A name or count is stale                     | The entry expires, and the next read watches again |
| The socket drops mid-run                 | No result toast                              | The reconnect refetches the run's status           |

## Decisions

- **Its own table, no foreign keys.** A link is between two Onshape workspaces.
  Neither has to be in a library, so nothing in the rest of the schema can be
  pointed at.
- **One row per edge.** The app this was ported from appended to two arrays per
  link, which could half-succeed. One row cannot.
- **A workflow, not the request.** Both operations are chains of Onshape writes;
  a rate limit partway through would otherwise leave a version cut and half the
  references moved, with nothing to resume from.
- **Direct push by default.** Cutting versions in somebody else's document is
  the opt-in, not the default.
- **The buttons run; the form is behind the row.** A push usually wants the next
  `V` number and nothing else, so that is one click. Naming a version, or
  pushing recursively, is a click on the row.
- **Thumbnails come from Onshape directly.** The browser showing the app is
  already signed in to Onshape, so the image element fetches the workspace's
  thumbnail itself and the bytes never cross the worker. Unverified against real
  Onshape; it fails to the same placeholder a workspace with no thumbnail gets.

## Unverified against Onshape

Nothing in this feature has run against real Onshape. `externalreferences` and
`updatereferences` are hand-authored from the Flask app this was ported from —
`externalreferences` is absent from Onshape's OpenAPI spec, and appears to be
OAuth-only. Everything else was checked against the spec, and the counts and
permissions came back as modelled, but a live push is what would prove it.

_Last reviewed: 2026-09-28_
