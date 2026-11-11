# Design check

## Purpose

Checking every Part Studio and Assembly of the workspace the app was launched
in against FRCDesign's practices, and listing what each breaks: under- and
over-defined sketches, a missing or misplaced Origin Cube, red, yellow and
suppressed features or mates, a rollback bar left above the end, parts without
a material, and fixed, floating or broken assembly instances. Anybody signed in
can run it on a document they can read.

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

enum DesignIssueType {
    SKETCH_UNDERDEFINED = "sketch-underdefined",
    SKETCH_OVERDEFINED = "sketch-overdefined",
    ORIGIN_CUBE_MISSING = "origin-cube-missing",
    ORIGIN_CUBE_NOT_FIRST = "origin-cube-not-first",
    ORIGIN_CUBE_SUPPRESSED = "origin-cube-suppressed",
    /** A red feature or mate. */
    FEATURE_ERROR = "feature-error",
    /** A yellow feature or mate. */
    FEATURE_WARNING = "feature-warning",
    FEATURE_SUPPRESSED = "feature-suppressed",
    ROLLBACK_NOT_AT_END = "rollback-not-at-end",
    PART_NO_MATERIAL = "part-no-material",
    INSTANCE_FIXED = "instance-fixed",
    /** Not mated, grouped, fixed or patterned. */
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
// Runs when the page opens on a workspace with no check cached, then only when asked.
function useDesignCheckQuery(target: TargetElement | undefined);
function checkAgain(target: TargetElement): Promise<void>;
function useIsDesignCheck(): boolean;
// The page picker's dot and New badge, until the page is first opened.
function useIsDesignCheckNew(): boolean;
```

`src/frontend/features/design-check/issue-text.ts`, from the messages in
`src/frontend/messages/en.json`

```ts
// One message per issue type; a type without one fails tsc.
function getDesignIssueName(type: DesignIssueType): string;
// From the first issue of its type, which carries any count.
function getDesignIssueHelp(issue: DesignIssue): string;
```

`src/frontend/routes/app/design-check.tsx` (the route, with its redirect),
`src/frontend/features/design-check/components/design-check-page.tsx` and
`src/frontend/features/design-check/components/design-check-results.tsx`

```ts
// Keeps the last results when checking again fails.
function DesignCheckPage(): ReactNode;
// One accordion item per tab, the launch's open, each with a switch to its tab.
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
| `ORIGIN_CUBE_MISSING` / `ORIGIN_CUBE_NOT_FIRST`            | Warning / Warning      | A Part Studio with no Origin Cube, or with it below the first feature                                                                                                                                                       |
| `ORIGIN_CUBE_SUPPRESSED`                                   | Warning                | The Origin Cube suppressed                                                                                                                                                                                                  |
| `FEATURE_ERROR` / `FEATURE_WARNING` / `FEATURE_SUPPRESSED` | Error / Warning / Info | A feature or mate Onshape marks red or yellow, or one left suppressed; never the Origin Cube for the last. A built Part Studio feature is also yellow when a selection box lost one pick beside another that still resolves |
| `ROLLBACK_NOT_AT_END`                                      | Warning                | A Part Studio's rollback bar above its last feature                                                                                                                                                                         |
| `PART_NO_MATERIAL`                                         | Warning                | A solid part with none, the Origin Cube's own cube aside                                                                                                                                                                    |
| `INSTANCE_FIXED`                                           | Warning                | An unsuppressed top-level instance that is fixed                                                                                                                                                                            |
| `INSTANCE_FLOATING`                                        | Warning                | An unsuppressed top-level instance no unsuppressed mate or group holds and no pattern copies, broken ones aside                                                                                                             |
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
([analytics.md](./analytics.md)); a reused result isn't.

**KV** `design-check-tab:{CHECKS_VERSION}:{documentId}:{elementId}:{microversionId}`
(`src/backend/features/design-check/document.ts`) — one tab's issues and sketch
note at one microversion, for a week. Shared by everyone who can read the
document, since a tab's issues don't depend on who asks. `CHECKS_VERSION` is
bumped when what the checks find changes.

**Query cache** the last check of each workspace, never stale, dropped five
minutes after the page closes (TanStack's default), so coming back later checks
again.

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

1. Opening the page on a workspace with no check in the cache asks
   `GET /api/design-check`, signed in. Signed out, the page asks them to sign
   in instead.
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
6. The navbar's refresh button, **Check again**, asks again; nothing else does.

7. With nothing found in any tab, the page says so.
8. Otherwise the document's severity badges head the page, beside the time of
   the check, then one accordion item per tab, in tab order, with its name and
   its own badges, or **Not checked** for a tab that failed. The launch's tab is
   marked **This tab** and starts open. Each tab holds one tinted box per issue
   type, worst first: its name, what to do about it, and every feature, part or
   instance it was found on.
9. Every other tab has a button that switches the Onshape window to it
   (`sendSwitchTabMessage`). Its issues are named only: Onshape opens and
   selects in the tab the app was launched in.
10. In the launch's tab, clicking a feature or mate's name opens it in Onshape's
    feature dialog
    (`sendOpenFeatureMessage`); a suppressed Part Studio feature, which Onshape
    won't open, is named only. Clicking a part's or a part instance's selects
    it in the Onshape window (`sendSelectPartMessage`): a part by its id, an
    instance by its id and its part's. A sub-assembly or broken instance is
    named only.

## User-facing strings

In [strings/design-check.md](../strings/design-check.md).

## Invariants

- A tab's cached result is the check of exactly that microversion, so what
  the page shows is what checking the tab now would find.
- A check reads the document's tabs as the caller (`getOnshapeApi`), behind
  `requireSignInMiddleware`, before any cached result, so it answers only
  someone Onshape lets read the document.
- A check runs when the page opens on a workspace with no check cached and on
  **Check again**, never on its own: the query is never stale and never
  retried, so nothing reruns while someone edits.
- Severity follows from the type alone; it is not sent.
- `checkDesign` is pure, so every check is tested without Onshape.
- A sketch's definition status failing to arrive fails no other check, and a
  tab failing fails no other tab; Onshape refusing the caller fails the whole
  check.
- Analytics records no document, element or name from a check.

## Failure and recovery

| What goes wrong                                 | Shows as                                                                                   | Put right by    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------- |
| Signed out                                      | The sign-in notice                                                                         | **Sign in**     |
| Onshape refuses or rate-limits the caller       | "Failed to check this document.", with **Send a report**                                   | **Check again** |
| Reading the document's tabs fails or times out  | The same                                                                                   | **Check again** |
| One tab's calls fail or time out                | That tab marked **Not checked**, the rest as checked                                       | **Check again** |
| **Check again** fails                           | The last results, under "Failed to check this document again. These are the last results." | **Check again** |
| A feature lost one of a box's picks, and builds | "Feature with a warning", though Onshape reports it `OK`                                   | —               |
| A feature lost every pick in a box, and builds  | Nothing: a sketch's plane on Top resolves to nothing too                                   | —               |
| The sketches can't be listed, or time out       | The other issues, and a note that sketches went unchecked                                  | **Check again** |
| Onshape stops sending `sketchSolveStatus`       | The note that sketches went unchecked, on every Part Studio                                | A change here   |

## Decisions

- **The whole document at once.** The point is to see every issue together:
  one tab's own problems are already in front of whoever has it open.
- **Asked for, never automatic.** Rechecking while someone works in the CAD
  would flag what they are halfway through, so a check runs only when asked.
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
  rollback bar above the end. A suppressed feature is info.
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
- **Grouped by type.** A Part Studio of thirty parts with no material is one
  box listing thirty names, not thirty boxes.

_Last reviewed: 2026-11-10_
