# How Onshape works

What we know about Onshape's behavior, for anyone changing code that calls it.
Each fact says where it comes from:

- _documented_ — Onshape's API guide or its OpenAPI spec says so.
- _observed_ — seen in the running app or in testing; Onshape doesn't promise it.
- _unverified_ — the code assumes it, and nobody has seen it either way yet.

Feature documents in [`architecture/`](./architecture/README.md) say what the
app does with these facts and link here rather than explaining Onshape again.
When you learn something about Onshape, add it here. When Onshape proves an
entry wrong, fix the entry and every piece of code that relied on it.

[Glassworks](https://cad.onshape.com/glassworks/explorer) runs any endpoint
against your own account, which is the quickest way to check an entry. The
owner's testbench at `/testbench` ([testbench.md](./architecture/testbench.md))
makes any call at any API version, shows which webhook events fire, and
shows the rate-limit headers Onshape answers each call with.

## Documents, workspaces, versions and microversions

A **document** holds **workspaces** and **versions**, and each of those holds
the same set of **elements** (tabs). Every id is a string unique within its
level: `documentId`, then an `instanceId` with its `instanceType` (`w`, `v` or
`m`), then an `elementId`. The app's path types for these are in
`src/backend/lib/onshape/path.ts`; [GUIDE.md](./GUIDE.md) shows how to build
them and the urls they become.

- **A workspace** is a branch someone edits. Every document has a default
  workspace, named on `GET /documents/{did}` as `defaultWorkspace` — _documented_.
  That it is always sent is _unverified_; the load throws when it isn't.
- **A version** is an immutable snapshot cut from a workspace. Nothing can be
  written to a version, and references between documents always point at one —
  _documented_.
- **A microversion** is the state of a document after one change. Every edit
  makes a new microversion, whether or not a version is ever cut. A microversion
  can be read and never written — _documented_.
- **An element's `microversionId`** (in `contents`) is the microversion it last
  changed in. It moves whenever the tab changes, including a change that comes
  from a tab it depends on: Onshape carries that change on to the dependent tab
  by itself. Cutting a version doesn't move it, and nor does reordering tabs, so
  an untouched tab has the same microversion in the workspace and in every
  version since its last change — _observed_. The load skips unchanged tabs on
  this, thumbnails are stored under it, and the library's change badges compare
  it ([loading.md](./architecture/loading.md),
  [thumbnails.md](./architecture/thumbnails.md),
  [version-manager.md](./architecture/version-manager.md)).
- **Edits since the last version** are counted per workspace, as
  `changesSinceVersionSave` on `GET /documents/d/{did}/w/{wid}/insertables`,
  and absent for a version — _documented_ as a field, its meaning _observed_.
  There is no count per tab. The endpoint's `elementId` parameter names the tab
  something is being inserted into, not a tab to count — _unverified_.
- **Versions** list oldest first, starting with the one Onshape names "Start"
  — _observed_. `POST /documents/d/{did}/versions` cuts one, takes the workspace
  in the body as well as the document in the path, and needs write on the
  document — _documented_. Onshape's own dialog suggests `V<n>`, one past the
  highest such name — _observed_.
- **Contents** (`GET /documents/d/{did}/{wvm}/{wvmid}/contents`) answers a
  folder tree in tab-bar order and a flat list of elements. Some tabs are in
  the flat list and missing from the tree — _observed_.
- **A few endpoints take a bare document id with no `/d/`**:
  `GET /documents/{did}` and `GET /documents/{did}/permissionset` —
  _documented_.

### References between documents

- `GET /documents/d/{did}/w/{wid}/externalreferences` lists every version of
  another document the workspace's tabs reference, and the latest version of
  each such document. It is missing from the OpenAPI spec and appears to work
  only with OAuth; its shape is _unverified_.
- `POST /elements/d/{did}/w/{wid}/e/{eid}/updatereferences` moves one tab's
  references. That it needs write on the tab's document and link on each
  document it references, and its body shape, are _unverified_.

[version-manager.md](./architecture/version-manager.md) is built on both.

## Elements

- The types the app handles are `PARTSTUDIO`, `ASSEMBLY`, `DRAWING`,
  `FEATURESTUDIO` and `BLOB` (`OnshapeElementType`) — _documented_.
- A part studio can hold any number of parts. An **open composite** is a part
  studio whose parts include a composite (`bodyType: "composite"`) beside the
  parts it is made of; the composite is the one to use, and its constituents
  are ignored — _observed_.
- A part studio's thumbnail is rendered when it is saved, and can still be
  being written out just after — _observed_.

## Configurations

A part studio or assembly declares **configuration parameters**
(`GET /elements/d/{did}/{wvm}/{wvmid}/e/{eid}/configuration`): enum, quantity,
boolean and string, told apart by `btType` (`OnshapeParameterType`) —
_documented_. [configurations.md](./architecture/configurations.md) covers what
the app makes of them.

- A parameter or an enum option can be hidden by a **visibility condition**.
  An always-visible parameter carries a no-op condition,
  `BTParameterVisibilityCondition-177` — _observed_.
- Onshape doesn't mark what a parameter is for. A part number, a derivation
  variable or a channel is only recognized by its name — _observed_.
- **A configuration is sent as text**, `id=value;id=value`.
    - As a query parameter, only `;`, `=` and `%` in a value are escaped. A value
      encoded twice reaches Onshape as `0.381%20m`, which isn't a quantity —
      _observed_.
    - Onshape reads a `+` in the query literally, and ignores a configuration
      with one in it without an error. Spaces have to be sent as `%20` —
      _observed_.
- **A quantity** can be sent as an expression, such as `(2 + 3) in`. A derived
  feature shows the value as it was sent — _observed_.
- **Onshape names a render by the value it computes from what it is sent**, so
  the same length spelled in other units, or rounded, can render separately —
  _observed_.
- **Inserting a part studio** with an empty configuration is refused; an
  assembly's is fine — _observed_.
- **Metadata** (`GET /metadata/...`) with computed properties is slow, which
  matters when it is asked once per configuration — _observed_.
- **Units** are per document, and
  `onshape.model.lifecycle.updateworkspaceunits` fires when a workspace's
  change — _observed_.

## Thumbnails

[thumbnails.md](./architecture/thumbnails.md) covers how the app uses these.

- The element thumbnail endpoint is unreliable in its version form and reliable
  in its workspace form — _observed_.
- Asked with `Accept: image/*`, a thumbnail still rendering answers 406 rather
  than 404; `*/*` gets the 404 — _observed_.
- **A configuration's thumbnail.** On a version, `insertables` with
  `elementId` and `configuration` reports a `predictableThumbnailId`; the first
  request for `GET /thumbnails/{id}/s/{size}` starts the render, and it answers
  404 until the render is done — _observed_. In a workspace, insertables reports
  one id for every configuration — _observed_. The documented configured
  thumbnail endpoint (`/ac/`) returned the default image — _observed_.
- **Asking for a second render abandons the first**, so ask for one size at a
  time — _observed_.
- **A workspace's own thumbnail** is served only to an OAuth caller, never to a
  browser fetching it directly — _observed_.

## Accounts, companies and teams

- **An owner** (`BTOwnerInfo`) is a user (`type: 0`) or a company (`type: 1`).
  A company is an enterprise or an educator plan's classroom;
  `isEnterpriseOwnedResource` tells them apart — the fields are _documented_,
  their meaning _observed_.
- **`cad`** is the company id of everything outside an enterprise: a personal
  account and a classroom alike — _observed_.
- **A launch** carries `companyId`, the company that owns the document (`cad`
  for a personal one), and `sessionCompanyId`, the company the caller's session
  is in: an enterprise's id, and `cad` everywhere else. Onshape sends
  `sessionCompanyId` only when the extension's action url names
  `{$sessionCompanyId}` — _observed_. [auth.md](./architecture/auth.md) covers
  sign-in.
- **OAuth's `company_id`** takes an enterprise's id and nothing else: a
  classroom's id is refused as "Invalid company ID", and `cad` is rejected.
  Without one, Onshape asks the caller which account to use — _observed_.
- **Every personal account shares the company `cad`**, so the company alone
  doesn't tell two personal accounts apart; the launch's `userId` does —
  _observed_.
- **Public documents** (`public` on the document) can be viewed and copied by
  every Onshape user — _documented_. An enterprise's document is never public
  — _observed_. Whether any user may also export one is _unverified_. Some reads
  of a public document answer without credentials, but a translation doesn't
  ("Unauthenticated API request", 401) — _observed_.
- **Teams** are owned by a company, or by a person (an old kind Onshape no
  longer creates). A team's events reach only a webhook registered on the
  company that owns it, by an admin of that company; a person's team has no
  such company, so it can't be watched — _documented_ (`companyId` on a
  webhook) and _observed_. Members are paged, 20 at a time — _observed_.

## Permissions

- `GET /documents/{did}/permissionset` answers the caller's permissions on a
  document, such as `READ`, `WRITE` and `LINK` — _documented_. A document
  shared with nobody answers 403 rather than an empty set — _observed_.
- `GET /documents/{did}` carries the same set as `permissionSet` — the field is
  _documented_; that it is always sent is _unverified_.
- A document the caller can't see answers 403 or 404 — _observed_.

## Webhooks

- **Transient or not.** `isTransient` defaults to `true`, and a transient
  webhook is deleted after a while without events — _documented_. How long a
  while is _unverified_. A webhook that must last is registered with
  `isTransient: false`.
- **Onshape drops a webhook without saying so.** A registration whose
  `webhook.register` ping fails is cancelled, and one whose deliveries error or
  stall is deactivated. Asking for it then answers 404 — _observed_. So
  deliveries are answered with a 200 at once, and the work done after.
- **Deliveries are not signed** — _observed_. The url carries a token, and
  a forged delivery can at most cause a refetch.
- **Events the app relies on** — names _documented_, behavior _observed_:
    - `onshape.model.lifecycle.createversion` — a version was cut.
    - `onshape.model.lifecycle.changed` — the workspace was edited.
    - `onshape.model.lifecycle.metadata` — a name or other metadata changed.
    - `onshape.model.lifecycle.updateworkspaceunits` — the units changed.
    - `onshape.document.lifecycle.shared` — sent for sharing and unsharing
      alike.
    - `onshape.team.addmember`, `onshape.team.removemember` — at company scope
      only, and for every team the company owns.
    - `webhook.register`, `webhook.unregister`, `webhook.ping` — about the
      webhook itself.
- `options.collapseEvents` merges a burst of the same event into fewer
  deliveries — _documented_ as a field, its effect _observed_.

## Calling the API

[platform.md](./architecture/platform.md) covers the client, retries and
errors.

- Every call goes to `https://cad.onshape.com/api/v17` with an OAuth bearer
  token, or an API key pair signed with an HMAC for scripts — _documented_. An
  expired access token answers 401, and the refresh token gets a new one —
  _documented_.
- **Rate limits** answer 429 — _documented_ — usually with `Retry-After`,
  which is sometimes absent — _observed_. Calls also count against the account's API
  allocation, which a full library reload spends a lot of — _documented_.
- **Each answer says how many calls are left** in `x-rate-limit-remaining`,
  and in no other header: nothing names the limit or when it resets —
  _observed_ (2026-11-08, the owner's OAuth token through the testbench). What
  it read after one check of each:
    - assembly definition (`GET /assemblies/d/…/e/…`): about 3,000;
    - everything else checked — evaluating FeatureScript, Part Studio and
      assembly features, document elements, session info: about 9,000.

    So reading an assembly's definition is the scarce one, a third of the rest.
    Which calls share a count is _unverified_: Part Studio features, assembly
    features and session info counted down together (8990, 8989, 8988), while
    document elements stood apart (8998) — consistent with a count per endpoint
    group, not proven. The counts are per user, so one person's heavy use
    doesn't spend another's — _unverified_, the owner's understanding. The
    window they refill over is _unverified_; checking again an hour later would
    tell.

- **Inserts often take several seconds** — _observed_ in Workers Logs for the
  week to 2026-11-09, as the whole insert request's wall time, which includes
  reading the insert location and building a fasten mate:

    | Succeeded          | Median | Over 5 s | Over 10 s | Over 20 s | Over 30 s |
    | ------------------ | ------ | -------- | --------- | --------- | --------- |
    | Into an assembly   | 1.3 s  | 12.5%    | 4.6%      | 1.0%      | 0.3%      |
    | Into a Part Studio | 3.0 s  | 33%      | 15%       | 2.6%      | 0.7%      |

    About 1% of insert requests went the full 60 s without an answer, and none
    answered 5xx. Whether Onshape still finishes an insert after the app stops
    waiting is _unverified_, and so is whether a 5xx means nothing was
    inserted.

- **Internal endpoints** — the ones Onshape's own web client calls, such as the
  custom toolbar's — are served at `/api/v14` — _observed_. Whether the same
  paths answer at the app's own version is _unverified_.
- **Onshape's error messages** are written for developers, not for the people
  using the app — _observed_.
- **Translations** (STEP export) run asynchronously and are polled. The file is
  kept as external data, and a translation can be read only by whoever started
  it — _observed_. [download.md](./architecture/download.md) covers the flow.
- **A fasten mate** between two instances, neither of them fixed, tends to
  move the first onto the second — _observed_.

## Custom toolbar

What Onshape's web client sends to change someone's custom toolbar, captured
from the browser — _observed_. None of it is documented, and none of it works
from the app's OAuth token: the testbench's Custom toolbar tab tried each, and
Onshape refused them all — _observed_. The app can't manage anyone's toolbar.

- `GET /toolbar/tools` lists every tool the signed-in user can see: Onshape's
  built-in ones (`ownerType` 2) and the user's own custom features
  (`ownerType` 0, `ownerId` the user's id).
- `POST /toolbar/tools/u/{userId}/create` adds tools under `parentId` (a node
  of the user's toolbar; where its id comes from is _unverified_), each as
  `{ insertableId, tool }`. A custom feature's `tool` names its Feature Studio
  as `commandDetails`, `d{documentId}::v{versionId}::e{elementId}::m{microversionId}`,
  with `command` its feature type and `signature` the two joined by `::`.
- `DELETE /toolbar/tools/u/{userId}/delete` takes `{ "remove": [toolId] }` as
  its body.

_Last reviewed: 2026-11-07_
