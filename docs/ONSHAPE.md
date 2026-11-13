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

## Features, sketches and assembly definitions

What the design check ([design-check.md](./architecture/design-check.md))
reads. _Observed_ here means seen on 2026-11-10 in a test document with each
problem planted, whose answers are kept, cut down, in
`src/__test_utils__/design-check-captures.ts`.

- **A feature list** (`GET /partstudios/…/features`, `GET /assemblies/…/features`)
  carries each feature's `featureStatus` in `featureStates`, keyed by feature
  id: `OK`, `INFO`, `WARNING` (yellow), `ERROR` (red) or `UNKNOWN` —
  _documented_, and _observed_. Asked with `includeGeometryIds=false`, a Part
  Studio's comes back `{}`, every feature's status left out, with sketches
  included or not — _observed_.
- **`rollbackIndex`**, on a Part Studio's list, is the index of the first
  feature below the rollback bar: 10 of 12 features with the bar above the last
  two, and 12 with it at the end — _observed_. The spec's -1 for the end was
  not seen.
- **A custom feature's `namespace`** names its Feature Studio as
  `d{documentId}::v{versionId}::e{elementId}::m{microversionId}`; the Origin
  Cube's starts `d321c197a842fc5f1a29e6621` — _observed_.
- **A feature that names itself from a template** comes back with the template
  unfilled: the Origin Cube's `name` is `#_name` — _observed_. Its
  `featureType` is the generic `myFeature`, so it says nothing either.
- **The Origin Cube refuses to build anywhere but first.** Second in the list
  it was `WARNING`, its tooltip reading "Origin Cube should be the first feature
  in your part studio to function correctly" — _observed_. The API's answer
  doesn't carry a feature's message.
- **A missing selection doesn't show in `featureStatus`**: an extrude Onshape
  drew with a warning, its tooltip "1 missing selection", was `OK` — _observed_.
  It shows in the pick: with geometry ids, each pick in a selection box
  (`BTMIndividualQuery-138` in a `BTMParameterQueryList-148`) carries
  `deterministicIds`, what it resolves to, and the lost face's was `[]` beside
  the remaining face's `["JlC"]`. A sketch plane on Top resolved to `[]` too,
  while Top picked in a Midplane's box resolved to `["JDC"]` beside a face's
  `["JoK"]`; without geometry ids every pick is `[]` — _observed_.
- **A fasten to the origin** is drawn with a warning while the assembly also
  has a fixed instance — "Fastened to origin even though Assembly has fixed
  part(s)" — and its `featureStatus` is `OK` — _observed_.
- **A sketch's definition** (`GET /partstudios/…/sketches`) is
  `sketchSolveStatus`: `UNDERDEFINED`, `WELL_DEFINED`, `OVERDEFINED` or
  `UNKNOWN` — the values _documented_ in Onshape's changelog (rel-1.183), the
  key _observed_. A suppressed sketch, and one below the rollback bar, isn't
  listed — _observed_.
- **An over-defined sketch is also yellow** (`WARNING`); an under-defined one is
  `OK` — _observed_.
- **A part's unset part number or description** is `null`; with no material,
  `material` is left out — _observed_. The Origin Cube's part is named "Origin
  Cube", with the material "Origin Cube Material" — _observed_.
- **An assembly definition** with `includeMateFeatures=true` lists each mate's
  two ends as `featureData.matedEntities[].matedOccurrence`, empty for the
  assembly origin, and each group's members as `featureData.occurrences` —
  _documented_ in the API guide, not the OpenAPI spec, and _observed_. An
  occurrence's `fixed`, and a pattern's `seedToPatternInstances` and
  `suppressed`, are _observed_.
- **A mate whose instance is suppressed** is grayed out, its tooltip
  "Inactive: One or more instances is suppressed", and its feature state is
  `featureStatus: "ERROR"` with `inactive: true` — _observed_.
- **Replicate and Mirror copies** are listed in the definition's
  `rootAssembly.parametricInstances`, each feature with its `children`'s
  `seedOccurrence` and `instanceIds` — _documented_ — and `type` "Replicate"
  or "Mirror" — _observed_. They aren't in `patterns`, and no mate or group
  names the copies — _observed_.
- **A derived mirror of a Part Studio** is a tab whose one feature has
  `featureType: "derivedMirror"`, and whose parts take their seeds' materials
  — _observed_.
- **A derived mirror** (an Assembly tab made by mirroring another) is listed
  there too, as `type` "Derived Assembly Mirror" with no `children` — _observed_.
  Nothing names the copies it made: its feature's `actionTypeArray` has one
  item per copy, each naming the seed's instance (`seedInstanceKey`), and the
  copies have no mates. An instance's `featureId`, in the spec, wasn't sent —
  _observed_.
- **An instance of a deleted part** keeps `type: "Part"`, with `partId: ""`,
  and Onshape draws it red — _observed_.
- **An instance whose tab was deleted** is drawn red, and comes back with only
  its `id` and `name`, no `type` or `partId` — _observed_. The spec's
  `status: "DeletedElement"` and `errorStatus` were on no instance, healthy or
  broken.
- **An instance's source**: a top-level instance names the tab it came from,
  `documentId` and `elementId`, with `documentMicroversion` for a tab of the
  same document — _observed_. That one from another document carries
  `documentVersion` instead is _unverified_.
- **The Origin Cube's mate connector**, as a fasten made by hand to the origin
  names it, is `BTMPartStudioMateConnectorQuery-1324` with `featureId`
  `{Origin Cube feature id}.mateConnector1` and the instance as its `path`,
  beside an implicit mate connector the mate owns, `ON_ENTITY` with its
  `originQuery` the origin's `featureId` `Origin` and `queryData`
  `ORIGIN_Z` — _observed_. A fasten naming the cube's mate connector alone,
  added through the API, is red — _observed_. One built the way a fasten made
  by hand is, its implicit connector given a placeholder id that its second
  query names, builds and puts the cube on the origin — _observed_.
- **A mate's `mateType`** in the assembly definition's `featureData` is
  `FASTENED` for a fasten — _observed_.
- **A change made through the API** isn't undone by undo (Ctrl+Z) in the
  Onshape window: a fasten the design check added stayed — _observed_.
- **Deleting an instance** is `DELETE /assemblies/.../instance/nodeid/{nid}`,
  `nid` being the instance's `id` from the definition — _documented_ (the
  OpenAPI spec; the API guide's example shows POST), and _observed_.
- **Deleting an Assembly's feature**, such as a mate, is
  `DELETE /assemblies/.../features/featureid/{fid}` — _documented_ (the
  OpenAPI spec).
- **Moving the rollback bar** is `POST /partstudios/.../features/rollback` with
  `{ "rollbackIndex": -1 }` to put it at the end — _documented_, and
  _observed_.
- **An inserted sketch** is left out of the assembly definition with
  `includeNonSolids=false`, which `getAssembly` sends by default — _observed_.
- **`openAnotherElementInCurrentWorkspace`**, a client message, shows another
  tab of the workspace, named by `anotherElementId` — _documented_. Onshape
  then loads the app's panel afresh for the new tab, from its extension's
  action url (`/init`), so nothing in the page's memory survives the switch —
  _observed_.
- **`stopRequest`**, a client message, ends the request its `messageId` names
  — _documented_. It leaves what a `requestSelectionHighlight` selected
  selected — _observed_. A highlight of no `selections` clears the window's
  selection — _observed_.
- **`openFeatureDialog`**, a client message, opens a feature's dialog in a
  workspace's Part Studio — _documented_ — and a mate's in an Assembly,
  suppressed or not — _observed_. A suppressed Part Studio feature doesn't
  open: the message does nothing, and Onshape's own list offers no **Edit** for
  it — _observed_.
- **`requestSelectionHighlight`**, a client message, selects the entities in
  its `selections` in the window. Onshape's example is a Part Studio face,
  `selectionType: "ENTITY"` with its `entityType` and its `selectionId`, the id
  `getPartStudioBodyDetails` gives — _documented_. In an Assembly, an entity
  also takes the `occurrencePath` of the instance it's in, and still needs the
  part's `selectionId`: the path only says which instance to look in. A
  top-level part instance's `entityType: "BODY"`, with the instance's `partId`
  as its `selectionId` and `[instanceId]` as its path, selects that instance,
  in the window and in the instance list — _observed_. In a Part Studio, a
  part's `partId` as a `BODY` entity's `selectionId`, with no path, selects the
  part — _observed_.

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
  sign-in. A newly made OAuth app's extension, on 2026-11-10, got the
  placeholder back unfilled, with Onshape's own `sessionCompanyId=cad` added
  after `companyId`; sign-in sent the placeholder as `company_id`, and Onshape
  answered with a JSON error in place of its sign-in page — _observed_ once.
  Why that app's isn't filled is _unverified_.
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
