# Design check

## Purpose

Checking every Part Studio and Assembly of the workspace the app was launched
in against FRCDesign's practices, and listing what each breaks: under- and
over-defined sketches, a missing or misplaced Origin Cube, red, yellow and
suppressed features or mates, a rollback bar left above the end, parts without
a material, and fixed, floating or broken assembly instances. Anybody signed in
can run it on a document they can read. Someone who can edit it can fix some
issues from the page, and dismiss any that are meant, for everyone.

It is not the library's build check ([build-issues.md](./build-issues.md)),
which checks the library's own documents when they load and shows editors what
it stores. A design check reads somebody's own document when they ask, and
shows only them. It borrows the build check's severities and its severity
badges, so the two read alike.

## Code map

In the order a check runs: asked, each tab read and checked, drawn.

`src/backend/features/design-check/routes.ts`

```text
GET /api/design-check?documentId=&instanceId=    DesignCheckOut; never cached
POST /api/design-check/fix   DesignFixIn         {}; makes one fix, as the caller
POST /api/design-check/dismiss   DesignDismissIn {}; 403 without edit access
```

`src/backend/features/design-check/dismissals.ts`

```ts
// Marks each issue the document has a dismissal for.
async function markDismissed(
    db: Db,
    documentId: string,
    tabs: TabCheck[]
): Promise<TabCheck[]>;
// Records one, or deletes it to put the issue back.
async function setDismissed(
    db: Db,
    userId: string,
    request: DesignDismissIn
): Promise<void>;
```

`canWrite` (`src/backend/features/version-manager/workspace-cache.ts`) says
whether the caller may edit the document, from the permission set `canRead`
caches.

`src/backend/features/design-check/fixes.ts`

```ts
// Moves the rollback bar (moveRollbackBar), deletes an instance
// (deleteInstance), or fastens the Origin Cube to the origin by its own mate
// connector, read where the instance came from.
async function applyFix(client: OnshapeApi, fix: DesignFixIn): Promise<void>;
```

`src/backend/features/design-check/document.ts`

```ts
// Reads the workspace's tabs as the caller, then checks each Part Studio and
// Assembly two at a time, reusing a cached result for a tab that hasn't changed.
async function checkDocument(
    c: AppContext,
    client: OnshapeApi,
    workspace: InstancePath
): Promise<TabCheck[]>;
```

`elementsInTabOrder` (`src/backend/features/load/parse-document-contents.ts`)
gives the tabs in the order Onshape shows them.

`src/backend/features/design-check/snapshot.ts`

```ts
// Three Onshape calls for a Part Studio, two for an Assembly, all at once.
async function readSnapshot(
    client: OnshapeApi,
    path: ElementPath,
    elementType: ElementType
): Promise<DesignSnapshot>;

interface PartStudioSnapshot {
    elementType: ElementType.PART_STUDIO;
    features: OnshapeFeatureListResponse;
    /** Undefined when Onshape couldn't list them; the rest is still checked. */
    sketches: OnshapeSketchList | undefined;
    parts: OnshapePart[];
}

interface AssemblySnapshot {
    elementType: ElementType.ASSEMBLY;
    definition: OnshapeAssemblyDefinition;
    features: OnshapeFeatureListResponse;
}

type DesignSnapshot = PartStudioSnapshot | AssemblySnapshot;
```

The calls are `getAllFeatures` and `getSketches`
(`src/backend/lib/onshape/endpoints/part-studios.ts`), `getParts`
(`src/backend/lib/onshape/endpoints/parts.ts`), and `getAssembly` and
`getAssemblyFeatures` (`src/backend/lib/onshape/endpoints/assemblies.ts`).

`src/backend/features/design-check/checks.ts`, pure

```ts
function checkDesign(snapshot: DesignSnapshot): DesignCheckResult;
// By its FeatureScript's document, or by name for a renamed copy kept elsewhere.
function isOriginCube(feature: Feature): boolean;

interface DesignCheckResult {
    /** Errors first, then warnings, then info. */
    issues: DesignIssue[];
    /** Unsuppressed sketches exist and Onshape reported none's status. */
    sketchStatusUnknown: boolean;
}
```

`src/backend/features/design-check/contract.ts`, a leaf module the frontend
also imports

```ts
// Errors leave a model broken; warnings are worth fixing.
function getDesignIssueSeverity(type: DesignIssueType): BuildIssueSeverity;
// Worst first.
function compareSeverity(a: BuildIssueSeverity, b: BuildIssueSeverity): number;
// What analytics records of a check.
function countDesignIssues(issues: DesignIssue[]): DesignIssueCounts;
// `{type}:{featureId, instanceId or partId}`, which a dismissal is kept under.
function getIssueKey(issue: DesignIssue): string;
// Undefined for a key no issue could have, which the dismiss route refuses.
function getIssueKeyType(key: string): DesignIssueType | undefined;
// The one type each fix is offered for, which analytics records it as.
function getFixedIssueType(fix: DesignIssueFix): DesignIssueType;

enum DesignIssueType {
    SKETCH_UNDERDEFINED = "sketch-underdefined",
    SKETCH_OVERDEFINED = "sketch-overdefined",
    ORIGIN_CUBE_MISSING = "origin-cube-missing",
    ORIGIN_CUBE_NOT_FIRST = "origin-cube-not-first",
    ORIGIN_CUBE_SUPPRESSED = "origin-cube-suppressed",
    /** An Assembly's Origin Cube with no fasten to the assembly origin. */
    ORIGIN_CUBE_NOT_FASTENED = "origin-cube-not-fastened",
    /** A red feature or mate. */
    FEATURE_ERROR = "feature-error",
    /** A yellow feature or mate. */
    FEATURE_WARNING = "feature-warning",
    FEATURE_SUPPRESSED = "feature-suppressed",
    /** Onshape grays it out: something it needs is suppressed. */
    FEATURE_INACTIVE = "feature-inactive",
    ROLLBACK_NOT_AT_END = "rollback-not-at-end",
    PART_NO_MATERIAL = "part-no-material",
    INSTANCE_FIXED = "instance-fixed",
    /** Not mated, grouped, fixed, or copied by a pattern, Replicate or Mirror. */
    INSTANCE_FLOATING = "instance-floating",
    INSTANCE_BROKEN = "instance-broken"
}

interface DesignIssue {
    type: DesignIssueType;
    /** The feature, part or instance's name in Onshape; absent for one about the whole tab. */
    subject?: string;
    /** Set for a feature or mate, which the page opens in Onshape where Onshape will. */
    featureId?: string;
    /** A part's, or the part a part instance shows; the page selects it in Onshape. */
    partId?: string;
    instanceId?: string;
    /** The Origin Cube's place in the list, or how many features the rollback bar hides. */
    count?: number;
    /** Set where the app can fix it, for someone who may edit the document. */
    fix?: DesignIssueFix;
    /** Someone with edit access marked it as meant. */
    dismissed?: boolean;
}

interface DesignDismissIn {
    documentId: string;
    elementId: string;
    issueKey: string;
    /** False puts a dismissed issue back. */
    dismissed: boolean;
}

enum DesignIssueFix {
    MOVE_ROLLBACK_TO_END = "move-rollback-to-end",
    DELETE_INSTANCE = "delete-instance",
    FASTEN_ORIGIN_CUBE = "fasten-origin-cube"
}

interface DesignFixIn {
    documentId: string;
    /** The workspace. */
    instanceId: string;
    elementId: string;
    fix: DesignIssueFix;
    /** The Assembly instance an instance's fix is about. */
    assemblyInstanceId?: string;
}

interface TabCheck {
    elementId: string;
    name: string;
    elementType: ElementType;
    /** Errors first, then warnings, then info; none for a tab that failed. */
    issues: DesignIssue[];
    /** Onshape reported no sketch's definition, so under-defined sketches went unchecked. */
    sketchStatusUnknown: boolean;
    /** Onshape answered this tab alone with an error, so it went unchecked. */
    failed: boolean;
}

interface DesignCheckOut {
    /** The document's Part Studios and Assemblies, in the order of its tabs. */
    tabs: TabCheck[];
    /** The caller may edit the document, and so dismiss issues. */
    canDismiss: boolean;
    /** Epoch ms. */
    checkedAt: number;
}

/** How many of each type one check found, which analytics records. */
type DesignIssueCounts = Partial<Record<DesignIssueType, number>>;
```

`BuildIssueSeverity` is the build check's
(`src/backend/features/build-checker/issues.ts`).

`src/frontend/features/design-check/queries.ts` and
`src/frontend/features/design-check/navigation.ts`

```ts
// Runs when the page or the library's navbar opens on a workspace with no
// check cached, then only when asked.
function useDesignCheckQuery(target: TargetElement | undefined);
function checkAgain(target: TargetElement): Promise<void>;
function useIsDesignCheck(): boolean;
// The page picker's dot and New badge, until the page is first opened.
function useIsDesignCheckNew(): boolean;
// Each fix in turn, stopping at the first refused, then checks again.
function useApplyFixesMutation(target: TargetElement);
// Shown at once in the cached check, and undone there if saving fails.
function useDismissMutation(target: TargetElement);
```

`src/frontend/features/design-check/fixes.ts`,
`src/frontend/features/design-check/components/fix-dialog.tsx` and
`src/frontend/features/design-check/open-fix-dialog.tsx`

```ts
// The fix an issue offers, as the confirmation lists it; none without one.
function planFix(
    target: TargetElement,
    tab: TabCheck,
    issue: DesignIssue
): PlannedFix | undefined;
// Every fix in the document, for Fix all.
function planFixes(target: TargetElement, tabs: TabCheck[]): PlannedFix[];
function getFixLabel(fix: DesignIssueFix): string;
// Every fix listed and checked; only those left checked are made, on confirming.
function openFixDialog(target: TargetElement, fixes: PlannedFix[]): void;
```

`src/frontend/features/design-check/issue-text.ts`, from the messages in
`src/frontend/messages/en.json`

```ts
// One message per issue type; a type without one fails tsc.
function getDesignIssueName(type: DesignIssueType): string;
// From the first issue of its type, which carries any count.
function getDesignIssueHelp(issue: DesignIssue): string;
```

`src/frontend/features/design-check/components/design-check-status.tsx`, in
the library's navbar (`src/frontend/components/app-navbar.tsx`)

```ts
// The document's errors and warnings, each tab's on hover; a click opens the
// page (`useSelectTab`). Nothing until a check has answered.
function DesignCheckStatus(): ReactNode;
```

`src/frontend/routes/app/design-check.tsx` (the route, with its redirect),
`src/frontend/features/design-check/components/design-check-page.tsx` and
`src/frontend/features/design-check/components/design-check-results.tsx`

```ts
// Keeps the last results when checking again fails.
function DesignCheckPage(): ReactNode;
// One accordion item per tab, the launch's open, each with a switch to its tab;
// dismissed issues left out until shown.
function DesignCheckResults(props: DesignCheckResultsProps): ReactNode;

interface DesignCheckResultsProps {
    target: TargetElement;
    result: DesignCheckOut;
    /** Checking again failed, so `result` is the check before. */
    failedAgain?: boolean;
}
```

`TargetElement` is the launch's tab (`src/frontend/lib/onshape-launch.ts`).

## The checks

Severity follows from the type alone (`getDesignIssueSeverity`), the same for
everyone.

| Type                                                       | Severity               | Raised for                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SKETCH_UNDERDEFINED` / `SKETCH_OVERDEFINED`               | Warning / Error        | An unsuppressed sketch Onshape reports so                                                                                                                                                                                   |
| `ORIGIN_CUBE_MISSING` / `ORIGIN_CUBE_NOT_FIRST`            | Warning / Warning      | A Part Studio with no Origin Cube, or with it below the first feature; never a derived mirror's                                                                                                                             |
| `ORIGIN_CUBE_SUPPRESSED`                                   | Warning                | The Origin Cube suppressed                                                                                                                                                                                                  |
| `ORIGIN_CUBE_NOT_FASTENED`                                 | Warning                | An Assembly's unsuppressed Origin Cube instance with no unsuppressed fasten to the origin alone; grouping or mating it to a part doesn't count                                                                              |
| `FEATURE_ERROR` / `FEATURE_WARNING` / `FEATURE_SUPPRESSED` | Error / Warning / Info | A feature or mate Onshape marks red or yellow, or one left suppressed; never the Origin Cube for the last. A built Part Studio feature is also yellow when a selection box lost one pick beside another that still resolves |
| `FEATURE_INACTIVE`                                         | Info                   | A mate Onshape grays out as inactive because an instance it needs is suppressed; Onshape sends it `ERROR` with `inactive`, and it isn't also an error                                                                       |
| `ROLLBACK_NOT_AT_END`                                      | Warning                | A Part Studio's rollback bar above its last feature                                                                                                                                                                         |
| `PART_NO_MATERIAL`                                         | Warning                | A solid part with none, the Origin Cube's own cube aside                                                                                                                                                                    |
| `INSTANCE_FIXED`                                           | Warning                | An unsuppressed top-level instance that is fixed                                                                                                                                                                            |
| `INSTANCE_FLOATING`                                        | Warning                | An unsuppressed top-level instance no unsuppressed mate or group holds and no unsuppressed pattern, Replicate or Mirror copies, broken ones and the Origin Cube's aside; none in a tab with an unsuppressed derived mirror  |
| `INSTANCE_BROKEN`                                          | Error                  | An unsuppressed instance Onshape sends with only its name and id, or a part instance with an empty part id                                                                                                                  |

The assembly is read without non-solid instances, so an inserted sketch is
never checked.

The Origin Cube is FRCDesign's FeatureScript
(https://frcdesign.org/best-practices/assembly-setup/), known by its document
at the start of the feature's `namespace`, or, for a copy kept in another
document, by a custom feature's name starting "Origin Cube"; a built-in feature,
a sketch or a mate named so isn't it. Onshape sends its name as the unfilled
template `#_name`, so its issues call it "Origin Cube". Its cube is the part
named exactly "Origin Cube" or "Cube of All Time".

## Storage

Each tab checked afresh is recorded as a `design_check` event, with the kind of
tab and how many of each issue type it found, and no document
([analytics.md](./analytics.md)); a reused result isn't. Each fix made is a
`design_fix` event and each dismissal a `design_dismiss`, with the issue's type
(`getFixedIssueType` for a fix, `getIssueKeyType` for a dismissal) and no
document; putting an issue back isn't recorded.

**KV** `design-check-tab:{CHECKS_VERSION}:{documentId}:{elementId}:{microversionId}`
(`src/backend/features/design-check/document.ts`) — one tab's issues and sketch
note at one microversion, for a week. Shared by everyone who can read the
document, since a tab's issues don't depend on who asks. `CHECKS_VERSION` is
bumped when what the checks find changes.

**D1** `design_check_dismissals`
(`src/backend/features/design-check/schema.ts`) — one row per dismissed issue:
the document, the tab, the issue's key, who dismissed it and when. Kept until
someone puts the issue back; a dismissal whose issue is gone matches nothing.

**KV** `document-permissions:` — the caller's permission set on the document,
for a day, shared with the version manager
([version-manager.md](./version-manager.md)); a check reads edit access from
it.

**Query cache** the last check of each workspace, never stale, shared by the
page and the navbar's summary, dropped five minutes after both close
(TanStack's default), so coming back later checks again. Onshape reloads the
panel on every tab switch, which empties it.

**KV** `seen-hints:`, `Hint.OPENED_DESIGN_CHECK` once the page has been opened
([auth.md](./auth.md)).

## Flows

### Finding the page

The page picker lists **Design Check** under Utilities when Onshape launched the
app in a workspace's Part Studio or Assembly (`useTargetElement`), with a dot
and a **New** badge until it is first opened (`useIsDesignCheckNew`). Opening it
records `Hint.OPENED_DESIGN_CHECK` (`useMarkHintSeen`). `beforeLoad` redirects
anyone who reaches the url without such a tab, and entry resumes into the page
only with one (`canResume` in `src/frontend/routes/index.tsx`).

### Checking

1. Opening the page, or a library, on a workspace with no check in the cache
   asks `GET /api/design-check`, signed in. Signed out, the page asks them to
   sign in instead, and the library's navbar shows nothing.
2. The route reads the workspace's tabs as the caller (`getContents`), and
   takes its Part Studios and Assemblies in tab order. Onshape refusing the
   caller here fails the check, before anything cached is read.
3. Each tab, two at a time, reuses its cached result when its microversion
   hasn't moved, which it does whenever the tab, or a tab it depends on,
   changes ([ONSHAPE.md](../ONSHAPE.md)). Otherwise its snapshot is read as the
   caller, in the default configuration, all calls at once. A Part Studio's
   features are asked for with geometry ids, without which Onshape sends no
   feature's status. If the sketches can't be listed for any reason but Onshape
   refusing the caller, the tab is checked without their status and says so.
4. `checkDesign` raises the tab's issues and sorts them worst first. An
   over-defined sketch, and an Origin Cube below the first feature, are each
   reported once, as themselves, rather than also as the warning they raise;
   one that is red is also a feature with an error. The result is cached and
   recorded through `trackDesignCheck`, both in the background.
5. A tab Onshape fails on, other than by refusing the caller, is marked failed
   and the rest go on; a refusal fails the whole check.
6. Alongside, the route asks whether the caller may edit the document
   (`canWrite`), and marks each issue the document has a dismissal for
   (`markDismissed`); neither is cached with the tab, so a dismissal shows on
   the next check whether or not the tab changed.
7. The page's navbar refresh button, **Check again**, asks again; nothing else
   does while the panel stays open.

### The results

1. With nothing found in any tab, or only dismissed issues, the page says so.
2. Otherwise the document's severity badges head the page, beside the time of
   the check, then one accordion item per tab, in tab order, with its name and
   its own badges, or **Not checked** for a tab that failed. The launch's tab is
   marked **This tab** and starts open. Each tab holds one tinted box per issue
   type, worst first: its name, what to do about it, and every feature, part or
   instance it was found on.
3. Every other tab has a button that switches the Onshape window to it
   (`sendSwitchTabMessage`). Onshape loads the panel afresh there, and the
   check it asks for answers from the cache. A tab's issues are named only
   until the app is launched in it: Onshape opens and selects in the tab the
   app was launched in.
4. In the launch's tab, clicking a feature or mate's name opens it in Onshape's
   feature dialog (`sendOpenFeatureMessage`); a suppressed Part Studio feature,
   which Onshape won't open, is named only. Clicking a part's or a part
   instance's selects it in the Onshape window (`sendSelectPartMessage`): a
   part by its id, an instance by its id and its part's. Hovering one selects
   it, and leaving clears the selection (`sendClearSelectionMessage`) unless it
   was clicked. A sub-assembly or broken instance is named only.

### The navbar's summary

1. In a library, launched in a workspace's Part Studio or Assembly and signed
   in, the navbar shows the Design Check icon, badged with the worst status
   left, and the document's error and warning counts beside it; dismissed
   issues and info are left out (`DesignCheckStatus`). It shows nothing until
   the check has answered, or if it failed.
2. Hovering it lists every tab with its severity badges, or **Not checked**,
   the launch's tab in bold, and the time of the check.
3. Clicking it, or **Open Design Check** in the card, opens the page, which
   answers from the same cache.

### Dismissing

1. For someone who may edit the document (`canDismiss`), each issue has a
   dismiss button: beside each name it lists, or under the help for one about
   the whole tab.
2. Clicking it sends `POST /api/design-check/dismiss` and drops the issue from
   the counts, badges, list and **Fix all** at once, in the cached check
   (`useDismissMutation`). The route checks edit access again (`canWrite`),
   saves the dismissal (`setDismissed`), keyed by the tab and `getIssueKey`, and
   records it for analytics (`trackDesignAction`).
3. **Show {n} dismissed issues**, under the severity badges or in the notice,
   shows them back in place, dimmed, each with a button that puts it back the
   same way.
4. Every check of the document marks the issue dismissed, for everyone, until
   someone puts it back.

### Fixing

1. An issue the app can fix carries `fix` from the check: a rollback bar above
   the end, a broken instance, and an Origin Cube not fastened to the origin. It
   shows a button beside it, in any tab; **Fix all** heads the page while there
   is any.
2. Either opens a confirmation listing each fix and its tab, checked: one fix,
   or every one in the document. Only those left checked are made, on
   confirming.
3. Each is `POST /api/design-check/fix`, in turn, made as the caller, so
   Onshape refuses anyone who can't edit the document. The rollback bar moves
   to the end (`moveRollbackBar`, index -1); the instance is deleted
   (`deleteInstance`); the Origin Cube is fastened to the origin
   (`fastenMateToOrigin`): its own mate connector,
   `{featureId}.mateConnector1` of the Origin Cube feature in the Part Studio
   the instance came from, read at that version or microversion, to an
   implicit connector the mate owns on the origin.
4. Each fix Onshape makes is recorded (`trackDesignAction`). The first fix
   refused stops the rest, with "Failed to make a fix. Checking again shows
   what changed." Either way the page checks again, which reads only the tabs
   the fixes changed.

## User-facing strings

In [strings/design-check.md](../strings/design-check.md).

## Invariants

- A tab's cached result is the check of exactly that microversion, so what
  the page shows is what checking the tab now would find.
- A check reads the document's tabs as the caller (`getOnshapeApi`), behind
  `requireSignInMiddleware`, before any cached result, so it answers only
  someone Onshape lets read the document.
- A check runs when the panel loads on a workspace with no check cached, for
  the page or a library, and on **Check again**; never while the panel stays
  open: the query is never stale and never retried, so nothing reruns while
  someone edits.
- Severity follows from the type alone; it is not sent.
- `checkDesign` is pure, so every check is tested without Onshape.
- A sketch's definition status failing to arrive fails no other check, and a
  tab failing fails no other tab; Onshape refusing the caller fails the whole
  check.
- Analytics records no document, element or name from a check, fix or
  dismissal.
- No fix is made without a confirmation that lists it, and each is made as the
  caller.
- Only someone Onshape lets edit the document records or deletes a dismissal,
  checked on the request itself, not only by hiding the button.
- A dismissal hides one issue, of one type, on one feature, part or instance,
  in one tab; it never hides another issue, and counts, badges and **Fix all**
  leave out exactly the dismissed.

## Failure and recovery

| What goes wrong                                 | Shows as                                                                                   | Put right by      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------- |
| Signed out                                      | The sign-in notice                                                                         | **Sign in**       |
| Onshape refuses or rate-limits the caller       | "Failed to check this document.", with **Send a report**                                   | **Check again**   |
| Reading the document's tabs fails or times out  | The same                                                                                   | **Check again**   |
| One tab's calls fail or time out                | That tab marked **Not checked**, the rest as checked                                       | **Check again**   |
| **Check again** fails                           | The last results, under "Failed to check this document again. These are the last results." | **Check again**   |
| A feature lost one of a box's picks, and builds | "Feature with a warning", though Onshape reports it `OK`                                   | —                 |
| A feature lost every pick in a box, and builds  | Nothing: a sketch's plane on Top resolves to nothing too                                   | —                 |
| The sketches can't be listed, or time out       | The other issues, and a note that sketches went unchecked                                  | **Check again**   |
| Onshape stops sending `sketchSolveStatus`       | The note that sketches went unchecked, on every Part Studio                                | A change here     |
| A fix is refused or fails                       | "Failed to make a fix. Checking again shows what changed.", the rest left unmade           | Fixing again      |
| The Origin Cube's Part Studio lost the cube     | The fix is refused: "The Origin Cube's Part Studio no longer has the Origin Cube."         | Fastening by hand |
| Saving a dismissal fails                        | The issue back as it was, with "Failed to save the change. It's back as it was."           | Dismissing again  |
| Edit access lost since the check                | The issue back as it was, with "Dismissing an issue needs edit access to the document."    | —                 |
| A dismissed issue's feature is renamed          | Still dismissed: the key holds its id, not its name                                        | —                 |

## Decisions

- **The whole document at once.** The point is to see every issue together:
  one tab's own problems are already in front of whoever has it open.
- **Checked when the panel loads, then only when asked.** Rechecking while
  someone works in the CAD would flag what they are halfway through, so while
  the panel stays open a check runs only on **Check again**. Loading it, a
  library included, checks the document once, so the navbar can show its
  counts without a visit to the page. Unchanged tabs answer from KV, so a load
  costs the tabs list and the tabs that changed. Each tab checked afresh this
  way is recorded as a check too.
- **Unchanged tabs reused by microversion, without webhooks.** A tab's
  microversion moves with every change to it or what it depends on, and the
  document's tabs list carries it, so one call tells which tabs to check again.
  Cached in KV, since losing a result only costs checking that tab again.
- **The default configuration.** The launch doesn't carry the configuration
  showing, so a configured tab is checked as its defaults.
- **Workspaces only.** A version can't be edited, so there is nothing to act on.
- **One severity per type, with no settings.** The app has no team to hold
  settings for, and settings per document would leave a team with several
  documents to repeat them in each; until there is a team, the severities are
  the same for everyone.
- **An error leaves a model broken; a warning is worth fixing.** A broken
  instance, a red feature and an over-defined sketch are errors. An
  under-defined sketch is a warning, since loose geometry, such as a game piece
  in an intake sketch, is sometimes meant; so are a yellow feature, a part with
  no material, a fixed or floating instance, the Origin Cube's issues and a
  rollback bar above the end. A suppressed feature is info, and so is an
  inactive one, which Onshape grays out as it does a suppressed one.
- **No part number or description check.** How a team numbers and describes its
  parts for a bill of materials is its own convention, and every part without
  one would be flagged.
- **A part is selected through the part it shows.** Onshape needs the part's
  id to select anything; an instance's occurrence path only says which
  instance to look in ([ONSHAPE.md](../ONSHAPE.md)). A broken instance has no
  part left, so it is named only. A selection cancels any selection request
  outstanding, and the page makes none.
- **A lost pick counts only beside one that still resolves.** A sketch's plane
  on Top resolves to nothing as well, so a box where nothing resolves can't be
  told from a sketch on Top. Top picked beside a face, as in a Midplane,
  resolves to its own id, so it isn't taken for a lost pick
  ([ONSHAPE.md](../ONSHAPE.md)).
- **Every fix confirmed, even one.** A fix changes someone's CAD for them, and
  Onshape's undo doesn't reach a change made through the API
  ([ONSHAPE.md](../ONSHAPE.md)), so nothing changes on a single click, the
  confirmation says so, and a list of several can be pared down.
- **The Origin Cube fastened as a fasten made by hand is.** Its own mate
  connector, which the cube's feature makes, to an implicit connector on the
  origin; a fasten naming the cube's connector alone fails. Reading where the
  instance came from finds the feature's id whichever document it is in
  ([ONSHAPE.md](../ONSHAPE.md)).
- **A loose Origin Cube is reported as not fastened, not as floating.** One
  issue, with the fix that sets it right.
- **Dismissals for the whole document, by those who can edit it.** A dismissal
  says the issue is meant, which is the team's call, not one viewer's; kept per
  person, a teammate would see it flagged again. Someone who can only read the
  document can't change what its editors see.
- **Kept in D1, not with the tab's cached result.** A dismissal must last, and
  the cached result is shared by microversion, which a dismissal doesn't move.
- **Keyed by the issue's type and id, not its name or the microversion.** A
  dismissal outlives editing the tab; renaming what it names keeps it, and an
  issue about the whole tab, such as the rollback bar, is one per tab.
- **Shown at once, without checking again.** Checking again reads the whole
  document over; the change is already known.
- **A derived mirror's Part Studio has no Origin Cube of its own.** The cube
  is the seed's, checked in the seed's tab. Its parts are still checked for a
  material: a mirrored part without one has the wrong mass too.
- **A derived mirror's tab has no floating instances.** Onshape doesn't say
  which instances it made ([ONSHAPE.md](../ONSHAPE.md)), and its copies follow
  their seeds without mates, so every instance there counts as held; one added
  by hand and left loose isn't flagged.
- **Grouped by type.** A Part Studio of thirty parts with no material is one
  box listing thirty names, not thirty boxes.

_Last reviewed: 2026-11-10_
