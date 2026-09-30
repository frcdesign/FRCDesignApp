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
| `src/backend/features/version-manager/tasks.ts`                                 | Pure: the steps a run will take, which its status lists                          |
| `src/backend/features/version-manager/jobs.ts`                                  | The run a workspace last started, and its status                                 |
| `src/backend/features/version-manager/failures.ts`                              | Which Onshape failures to retry, and each in words                               |
| `src/backend/features/version-manager/workspace-cache.ts`                       | A linked workspace's names and pending-change count, cached                      |
| `src/backend/features/version-manager/routes.ts`                                | Every route below                                                                |
| `src/frontend/features/version-manager/queries.ts`                              | The queries and mutations                                                        |
| `src/frontend/features/version-manager/components/linked-workspace-section.tsx` | A direction's list, its rows, and everything they can run                        |
| `src/frontend/features/version-manager/job-report.ts`                           | How a run is going or went, in words                                             |
| `src/frontend/features/version-manager/components/last-run-callout.tsx`         | The last run, going or finished, as a callout at the top of the page             |
| `src/frontend/features/version-manager/components/job-details.tsx`              | The run's steps as they complete, in the Details modal                           |
| `src/frontend/routes/app/version-manager.tsx`                                   | The page: two sections, one per direction                                        |

## Storage

**D1** `workspace_links`: `id`, `source_document_id`, `source_workspace_id`,
`target_document_id`, `target_workspace_id`, `created_at`. One row per edge, the
source being the parent and the target the child. Unique across the four ids,
with an index on each end so a lookup in either direction scans neither. It
holds no foreign key into the rest of the schema: a link is between two Onshape
workspaces, neither of which need be in any library.

**KV** `version-job:{documentId}|{instanceId}` — the `VersionJobStatus` of the
run a workspace last started, for six hours: `RUNNING` with its instance id,
what it was aimed at and each of its steps as far as it has got, then how it
ended — its counts, and why any step failed.

**KV** `linked-workspace:{documentId}|{instanceId}` — a linked workspace's
document and workspace names, for a week.

**KV** `linked-workspace-changes:{documentId}|{instanceId}` — its
`changesSinceVersionSave`, for an hour.

**Browser** `isParentsOpen`, `isChildrenOpen`, `quickActionTipCount`,
and `hasOpenedVersionManager` in `uiState`.

## Flows

### Finding the page

The page picker marks the version manager with a dot and a **New** badge for
somebody who has a workspace to act on, has never opened the page in this
browser (`hasOpenedVersionManager`), and has nothing linked. Links of their own
are the sign they have found it, whether or not this browser remembers.
`useIsVersionManagerNew` only asks for the links while the answer could still
be yes, so it costs one Onshape call per person rather than one per page.

### Showing the page

The tab appears only when Onshape launched the app in a workspace
(`useTargetWorkspace`); `beforeLoad` redirects anyone who reaches the url
without one.

`GET /api/workspace-links` answers `{ parents, children, documentName }` — the
last being this workspace's own document, which the page's copy names. For each
row it asks
Onshape whether the caller may read the far end, and — from the cache — what it
is called. A workspace the caller cannot read comes back `isOpenable: false` and
unnamed: they are shown that a link exists, not what it points at.

Each parent also carries `unversionedChanges`: how far it has moved since its
own last version (`changesSinceVersionSave` on the insertables response, asked
with no `include` flags so Onshape enumerates nothing). A pull has to cut a
version to bring those edits in, so the row shows the count as a badge.

### Linking

`POST /api/workspace-links` takes the url somebody pasted, already parsed to a
workspace by `parseOnshapeWorkspace`. Only a workspace will do: a version cannot
be written to, and a url that stops at the document is refused rather than
resolved to the default workspace, which would be a different one than whoever
copied the link was looking at.

`POST /api/workspace-link/:linkId/move` turns a link around, for one filed the
wrong way up — **Switch to parent** or **Switch to child** in the row's menu.
It rewrites the row rather than deleting and re-adding it. Where
the reversed edge already exists — a pair that links both ways — it drops this
row instead, the unique index over the four ids allowing only one.

`DELETE /api/workspace-link/:linkId` needs write on **either** end: a link
belongs to both workspaces.

### Pushing

`POST /api/push-version` resolves what the push reaches into an ordered list of
steps, checks permissions across all of them, names every document from the
cache, starts the workflow and answers the run's first status.

A push or pull always cuts a new version, whether or not anything changed since
the last one. A version takes the name the form was given, and otherwise the one
Onshape's own dialog would offer that document (`nextVersionName`), so a
recursive push left unnamed numbers each document from its own history. The
form shows that suggestion as a placeholder and sends a name only when one was
typed.

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
writes to, and link on each one it versions.

**Update references** in a child's menu, or **Update all references** in the
section's, is a push with `updateOnly`: it cuts nothing, and moves the children
onto this document's newest version — whatever Onshape reports their references
out of date against. It cannot be recursive, which would need the versions it
does not cut.

### Pulling

`POST /api/pull-references` versions each parent it is aimed at and moves this
workspace's references onto that version: a reference points at a version, so
a parent's unversioned edits are only pullable once there is one holding them.
`PARENTS` takes the linked parents, `ONE` a single parent. **Update references**
in a parent's menu is a pull with `updateOnly`, which cuts nothing and moves
onto the version the parent already has.

`ALL` — **Update all references** in the parents' menu — is every out-of-date
reference, linked or not, moved onto
whatever version each document already has. It versions nothing, the documents
behind those references being nobody's to cut a version in, and it is the one
thing the parent list cannot express.

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
- A failure on any tab is the document's, and leaves the step. The app this was
  ported from swallowed them one tab at a time; permissions are per document,
  so a push that only half landed would have read as a success.

### Running the steps

A run's steps are laid out before it takes any (`planTasks`): a version of a
document, or its references moved. Each runs through `_task` in `workflow.ts`,
which reports it started and then does it in its own Workflow step. A failure
that could go differently next time — a rate limit, a 408 or 5xx, or no answer
at all (`isTransient`) — is retried from the top of the step; tabs already moved
need nothing the second time. Any other fails the step at once, as a
`NonRetryableError` worded by `describeStepFailure` from its status and the call
that failed ("Couldn't update this document's references."). Onshape's own
messages are never shown: they are written for developers.

A failed step is recorded, with its reason, and the run goes on. It skips only
what needed the failure: everything after this document's own version when that
fails, a recursive push's version of a document whose references failed (it
would hold the ones that did not move), and a pull's reference update when no
parent could be versioned. A document past a skipped one keeps the version of
it that it has.

Tabs are updated one at a time. The port's comment says doing them concurrently
caused problems and does not say why, so this follows it rather than finding out
in somebody's document.

### Recording a run

Once the run has finished or stopped, the workflow calls `trackVersionRun`
with its kind, how it was aimed, and three counts: versions created, workspaces
and tabs updated. The event belongs to no library, and rolls up into
`daily_version_metrics`, which the app dashboard reports as references updated
and versions synced, beside the documents linked right now. See
[analytics.md](./analytics.md).

### Watching a run

The route stores and pushes `RUNNING` as it starts the workflow, with what it
was aimed at; the workflow's `report-{n}` steps store and push each step as it
starts, and `finish-job` how the run ended, over the socket in
[platform.md](./platform.md). A run that throws outside a step is reported too:
`FAILED`, with what it had done and a reason from `describeRunFailure`. A later
run's mark is never overwritten by an earlier run's report. The
client asks `GET /api/version-job` once when the page opens and again after a
reconnect; nothing polls. A client's socket is tagged with the workspace it was
launched in as well as its library, so a run reaches the people in that document
and nobody else.

`GET /api/version-job` answers the stored status. A mark still reading
`RUNNING` is checked against the instance, since a run that died before it
could report leaves one behind.

While a run is going, a spinner sits where it was started — beside the row, or
in the section's header — and the page is headed by a callout with a spinner
(`LastRunCallout`): "Pushing to Practice Bot...", "Pulling from 2 documents..."
(`runningHeadline` in `job-report.ts`). Its **Details** opens `JobDetails`, which
lists the steps under each document — its name a link into it — with their
states, and follows the run as the reports arrive. A finished reference update
carries how many tabs it moved.

How it went arrives as one toast at the end (`job-toasts.ts`), headed by
`jobHeadline` — "Push succeeded", "Push partially succeeded" (a step failed
after something changed), "Push failed", or "Update …" for an update-only run:
green and gone in a few seconds on success; yellow or red, and up until closed,
otherwise, with **Details**, where each failed step gives its reason.

The callout then carries the same headline and how long ago, in the outcome's
color and with its icon, for as long as the status is kept. It cannot be closed, and its
**Details** opens the same modal.

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
- A run is recorded once, after it has finished, and never fails the run.
- A recursive push versions every workspace it passes through, in topological
  order.
- Nothing about a workspace the caller cannot read reaches them: no name, and no
  thumbnail.
- Permissions are never cached; names and change counts are.
- A push or pull always cuts its versions; only an update-only run cuts none.
- A run that finished, or stopped, says so: its status is stored whichever way
  it ended, step by step.
- A failure is a document's, never a tab's, and fails only its own step: the
  run goes on to everything that did not need it.
- Only a transient Onshape failure is retried, and only our own wording of a
  failure reaches the person who ran it.

## Failure and recovery

| Failure                                  | Result                                       | Recovery                                           |
| ---------------------------------------- | -------------------------------------------- | -------------------------------------------------- |
| A linked document is unshared or deleted | The row shows "Missing access" and no name   | Remove the link                                    |
| The caller cannot write to a child       | The push is refused before it starts         | The child's owner shares write access              |
| Onshape rate-limits the run              | The step waits its `Retry-After` and resumes | None needed                                        |
| Onshape errors or times out on a tab     | The step retries                             | None needed                                        |
| Onshape refuses a document mid-run       | Its step fails at once; the run goes on      | Details names the step and why; run it again       |
| A step runs out of retries               | It fails; the run goes on                    | Details names the step and why; run it again       |
| The links form a cycle                   | A recursive push is refused                  | Remove a link                                      |
| A webhook Onshape dropped                | A name or count is stale                     | The entry expires, and the next read watches again |
| The socket drops mid-run                 | No result toast                              | The reconnect refetches the run; the callout shows |

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
- **The row is the form; the menu is the runs.** Rows carry no push or pull
  button: a list of documents reads as a list, and the buttons competed with the
  names. Clicking a row opens the form, ctrl-clicking (⌘ on a Mac, where
  ctrl-click is the context menu) runs it under the defaults, and the menu says
  so beside the item it is a shortcut for. The menu holds the runs alone —
  anybody who did not want the defaults is one click from the form already.
- **Always a new version; updating is its own action.** A push or pull that
  sometimes versions and sometimes does not reads oddly, most of all a pull that
  versions nothing. Moving references without versioning is asked for by name
  instead — **Update references** — and a push or pull does what it says.
- **Unnamed versions are numbered per document.** A name is sent only when one
  was typed; the suggestion is this document's next number, which would be
  wrong for every other document a recursive push versions.
- **Failures are per document, and runs push on past them.** Permissions are
  per document, and nothing observed fails one tab and not the rest. A run
  aimed at several documents finishes every one it can, and the report names
  each step that failed and why, in our words.
- **The result is stored, not read off the instance.** The instance's output is
  lost when the run throws, and a failed run is the one whose report matters.
- **Thumbnails are proxied.** `GET /api/workspace-thumbnail` fetches the
  workspace's own thumbnail under the caller's OAuth token. Letting the image
  element fetch Onshape directly was tried; Onshape serves a thumbnail only to
  an OAuth caller, which the browser is not.

## Unverified against Onshape

Nothing in this feature has run against real Onshape. `externalreferences` and
`updatereferences` are hand-authored from the Flask app this was ported from —
`externalreferences` is absent from Onshape's OpenAPI spec, and appears to be
OAuth-only. Everything
else was checked against the spec, and the counts and
permissions came back as modelled, but a live push is what would prove it.

_Last reviewed: 2026-09-29_
