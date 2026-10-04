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
| `src/backend/features/version-manager/graph.ts`                                 | Pure: the order a recursive push or pull runs in, and cycle detection            |
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
run a workspace last started, for six hours: `RUNNING` with its workflow run id,
what it was aimed at and each of its steps as far as it has got, then how it
ended — its counts, and why any step failed.

**KV** `linked-workspace:{documentId}|{instanceId}` — a linked workspace's
document and workspace names, for a week.

**KV** `linked-workspace-changes:{documentId}|{instanceId}` — its
`changesSinceVersionSave`, for an hour.

Both are dropped by the linked workspace's webhook when it changes, and by
`POST /api/workspace-links/refresh` — the navbar's refresh button, shown on this
page alone — for every workspace linked to the caller's. A run drops the change
count of each workspace it versions or moves (`forgetChanges`, a step after
each of its own), and the client reads the links again once the run ends, so a
parent's badge reflects the version just cut.

**Browser** `isParentsOpen`, `isChildrenOpen` and `quickActionTipCount` in
`uiState`.

## Flows

### Finding the page

The page picker marks the version manager with a dot and a **New** badge for
somebody who has a workspace to act on and has never linked a document or
started a push or pull (`useIsVersionManagerNew`). Either is recorded against
the user in KV as a side effect of the route that does it (`Hint.USED_VERSION_MANAGER`, see
[auth.md](./auth.md)), so the dot stays gone on every computer they use.

### Showing the page

The tab appears only when Onshape launched the app in a workspace
(`useTargetWorkspace`); `beforeLoad` redirects anyone who reaches the url
without one.

`GET /api/workspace-links` answers `{ parents, children, documentName }` — the
last being this workspace's own document, which the page's copy names. For each
row it asks Onshape whether the caller may read the far end, and — from the
cache — what it is called. A workspace the caller cannot read comes back `isOpenable: false` and
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
copied the link was looking at. A document already linked to this workspace, as
a parent or a child and in any of its workspaces, is refused with a 409. The
answer names what was linked (`AddLinkOut`), for the toast.

`POST /api/workspace-link/:linkId/move` turns a link around, for one filed the
wrong way up — **Switch to parent** or **Switch to child** in the row's menu.
It rewrites the row rather than deleting and re-adding it. Where
the reversed edge already exists — a pair that links both ways — it drops this
row instead, the unique index over the four ids allowing only one.

`DELETE /api/workspace-link/:linkId` needs write on **either** end: a link
belongs to both workspaces.

### Pushing

`POST /api/push-version` refuses to start while a run from this workspace is
still going (`requireIdle`, 409), resolves what the push reaches into an ordered
list of steps, checks permissions across all of them, names every document from
the cache, starts the workflow and answers the run's first status.

A push or pull always cuts a new version, whether or not anything changed since
the last one. A version takes the name the form was given, and otherwise the one
Onshape's own dialog would offer that document (`nextVersionName`), so a
recursive push left unnamed numbers each document from its own history. The
form opens with that suggestion filled in and will not submit a blank name;
while the name is still the untouched suggestion, `VersionForm` sends none, so
each document still gets its own next number.

1. **Direct** (the default, `PushScopeKind.CHILDREN` or `ONE`): a version of
   this workspace, then each child's references moved onto it. The children are
   left un-versioned, so their owners decide when to cut one.
2. **Recursive** (`DESCENDANTS`, or `ONE` with `recursive`): the whole closure
   below this workspace in topological order, cutting a version of each as it
   passes. A workspace two hops out can only pick the change up from a version
   of the workspace between them, so there has to be one. Two parents feeding
   one workspace is why the order is topological rather than breadth-first: it
   must be updated once, after both have versions. A cycle is refused before
   the run starts (`LinkCycleError`, answered as a 409), and so are two
   workspaces of one document (`requireDistinctDocuments`): a version is pinned
   per document, so the second would move everything after it.

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

An update-only pull needs only read on its parents; one that versions them
needs write and link, and refuses two parents in one document as a recursive
push does.

A **recursive** pull (`ANCESTORS`, or `ONE` with `recursive`) carries on up
through the parents' own parents: the whole closure above this workspace in
topological order (`pullOrder`), each one moved onto the new versions of its
parents (`referencing` lists those with parents in the run) and then versioned
itself. This workspace moves last, onto every version the run cut. It needs write and
link on each document it versions, and is refused, as a recursive push is, over
a cycle or two workspaces of one document. It cannot be update-only.

`ALL` — **Update all references** in the parents' menu — is every out-of-date
reference, linked or not, moved onto whatever version each document already
has. It versions nothing, the documents
behind those references being nobody's to cut a version in, and it is the one
thing the parent list cannot express.

### Updating references

`references.ts` is what both run. `planReferenceUpdates` is pure: it turns
Onshape's `externalreferences` response into the updates to post, grouped by
tab. `updateOutdatedReferences` reads the references, posts each tab's updates
and returns the counts.

Two departures from the app this was ported from:

- Where a push has pinned a version for a document, a reference is updated
  whenever the version it points at differs from the pinned one, rather than when Onshape
  flags it `isOutOfDate`. The push cut that version moments earlier, and the
  flag is not something to race.
- A failure on any tab is the document's, and leaves the step. The app this was
  ported from swallowed them one tab at a time; permissions are per document,
  so a push that only half landed would have read as a success.

### Running the steps

A run's steps are laid out before it takes any (`planTasks` in `tasks.ts`): a
version of a document, or its references moved. A push versions this workspace
and then moves each child, versioning each after it when recursive; a pull
versions each parent and then moves this workspace, moving each parent onto
those above it first when recursive. An update-only run is the reference moves
alone.

Each step runs through `runTask` in `workflow.ts`, which reports it started, then
makes each Onshape call in its own retried Workflow step. A failure that could
go differently next time — a rate limit, a 408 or 5xx, or a request that never
got an answer (`isTransient`) — is retried from the top of that step; tabs
already moved need nothing the second time. Any other fails the step at once,
as a `NonRetryableError` worded by `describeStepFailure` from its status and the
call that failed ("Couldn't update this document's references."). Onshape's own
messages are never shown: they are written for developers.

Cutting a version is two steps, so a retry cannot cut a second one: the name is
settled first, and the create step looks for a version of that name made since
the run started (less a minute for clock skew) before it creates one.

A failed step is recorded, with its reason, and the run goes on. It skips only
what needed the failure: everything after this document's own version when that
fails, a recursive run's version of a document whose references failed (it
would hold the ones that did not move), and a pull's reference update when no
parent could be versioned. A document past a skipped one keeps the version of
it that it has.

Tabs are updated one at a time. The port's comment says doing them concurrently
caused problems and does not say why, so this follows it rather than finding out
in somebody's document.

### Recording a run

Once the run has finished or stopped, its `record-run` step calls
`trackVersionRun` with its kind, how it was aimed, whether it was update-only,
its outcome (`jobOutcome`: success, partial or failed), how many steps failed,
and the versions it created and tabs it updated. A failure to record is logged
and swallowed. The event belongs to no library, and rolls up into
`daily_version_metrics`, which the app dashboard reports as runs (and how many
had failures), tabs updated and versions created, beside the documents linked
right now. See [analytics.md](./analytics.md).

### Watching a run

The route stores `RUNNING` as it starts the workflow, with what it was aimed at;
the workflow's `report-{n}` steps store each step as it starts, and
`finish-job` how the run ended. A run that throws outside a step is reported
too: `FAILED`, with what it had done and a reason from `describeRunFailure`.
Each store is announced over the socket in [platform.md](./platform.md) by the
workspace's key alone, and the client refetches `GET /api/version-job`, which
needs read on the workspace: the status names documents, so it goes only to
somebody who may see them. The client also asks once when the page opens and
again after a reconnect; nothing polls.

`GET /api/version-job` answers the stored status. A mark still reading
`RUNNING` is checked against its workflow run, since a run that died before it
could report leaves one behind: once the workflow run has finished, its running
step is marked failed and those it never reached skipped. When Workflows
can't be asked, the mark stands: the workflow run outlives the mark, so a failed
read is transient.

While a run is going, a spinner sits where it was started — beside the row, or
in the section's header — and the page is headed by a callout with a spinner
(`LastRunCallout`): "Pushing to Practice Bot...", "Pulling from 2 documents..."
(`runningHeadline` in `job-report.ts`). Its **Details** opens `JobDetails`, which
lists the steps under each document — its name a link into it — with their
states, and follows the run as the reports arrive. A finished reference update
carries how many tabs it moved.

How it went arrives as one toast at the end (`job-toasts.ts`), headed by
`jobHeadline` — "Push succeeded", "Push partially failed" (a step failed
after something changed), "Push failed", or "Update …" for an update-only run:
green and gone in a few seconds on success; yellow or red, and up until closed,
otherwise, with **Details**, where each failed step gives its reason.

The callout then carries the same headline and how long ago, in the outcome's
color and with its icon, for as long as the status is kept. It cannot be closed, and its
**Details** opens the same modal.

### Keeping a linked workspace current

A cache miss on a linked workspace's names registers a transient webhook on it for
`onshape.model.lifecycle.changed`, `.metadata` and `.createversion`. A delivery
drops both cached entries, so the next panel to open asks Onshape again. Onshape
deletes a transient webhook that goes quiet, so the entries expire as well.

## Invariants

- A link is stored once, as one row. Both directions are read off it.
- Only a workspace is ever linked, pushed to or pulled into. A version is a
  snapshot with no references to update, and a microversion cannot be written to.
- Onshape decides what may be done, not the app's access levels. Every route
  checks the caller's Onshape permissions on the documents it would touch.
- A push or pull checks every workspace it would write to before it cuts
  anything.
- One run at a time per workspace, and no run versions one document twice.
- A retried step never cuts a second version.
- A run is recorded once, after it has finished, and never fails the run.
- A recursive push or pull versions every workspace it passes through, in
  topological order.
- Nothing about a workspace the caller cannot read reaches them: no name, no
  thumbnail, and no run status. The socket says only that a status changed.
- Permissions are never cached; names and change counts are.
- A push or pull always cuts its versions; only an update-only run cuts none.
- A run that finished, or stopped, says so: its status is stored whichever way
  it ended, step by step.
- A failure is a document's, never a tab's, and fails only its own step: the
  run goes on to everything that did not need it.
- Only a transient Onshape failure is retried, and only our own wording of a
  failure reaches the person who ran it.

## Failure and recovery

| Failure                                  | Result                                         | Recovery                                           |
| ---------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| A linked document is unshared or deleted | The row shows "Missing access" and no name     | Remove the link                                    |
| The caller cannot write to a child       | The push is refused before it starts           | The child's owner shares write access              |
| Onshape rate-limits the run              | The step waits its `Retry-After` and resumes   | None needed                                        |
| Onshape errors or times out on a tab     | The step retries                               | None needed                                        |
| Onshape refuses a document mid-run       | Its step fails at once; the run goes on        | Details names the step and why; run it again       |
| A step runs out of retries               | It fails; the run goes on                      | Details names the step and why; run it again       |
| The links form a cycle                   | A recursive push or pull is refused            | Remove a link                                      |
| A run is already going from here         | The new one is refused, and the UI disables it | Wait for it to finish                              |
| A webhook Onshape dropped                | A name or count is stale                       | The entry expires, and the next read watches again |
| The socket drops mid-run                 | No result toast                                | The reconnect refetches the run; the callout shows |

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
- **Pulling can recurse, by request.** A pull that carries on upstream
  versions documents beyond the parents it names, as a recursive push does
  downstream, so it is asked for by name — **Quick recursive pull**, or the
  form's **Recursive** — and never the default.
- **The suggested name is numbered per document.** The suggestion is this
  document's next number, which would be wrong for every other document a
  recursive push versions, so the form sends it as no name. A name somebody
  typed, even one spelled `V<n>`, is used as given.
- **Failures are per document, and runs push on past them.** Permissions are
  per document, and nothing observed fails one tab and not the rest. A run
  aimed at several documents finishes every one it can, and the report names
  each step that failed and why, in our words.
- **The socket says that, not what.** Everybody in a document shares its
  socket, not its permissions, so a push names the workspace alone and each
  client asks for the status under its own access.
- **A version is found before it is cut.** A step can be retried after Onshape
  created the version but before the answer arrived; looking it up by name and
  time is what keeps a retry from cutting two.
- **The result is stored, not read off the workflow run.** Its output is
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

_Last reviewed: 2026-09-30_
