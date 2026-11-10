# Design check

## Purpose

Checking the Part Studio or Assembly the app was launched in against
FRCDesign's practices, and listing what it breaks: under- and over-defined
sketches, a missing or misplaced Origin Cube, red, yellow and suppressed
features or mates, a rollback bar left above the end, parts without a material,
part number or description, and fixed, floating or broken assembly instances.
Anybody signed in can run it on a tab they can read.

It is not the library's build check ([build-issues.md](./build-issues.md)),
which checks the library's own documents when they load and shows editors what
it stores. A design check reads somebody's own tab when they ask, stores
nothing, and shows only them. It borrows the build check's severities and its
severity badges, so the two read alike.

## Code map

In the order a check runs: asked, read, checked, drawn.

`src/backend/features/design-check/routes.ts`

```text
GET /api/design-check?documentId=&instanceId=&elementId=&elementType=    DesignCheckOut; never cached
```

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
function getDesignIssueSeverity(type: DesignIssueType): BuildIssueSeverity;
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
    PART_NO_PART_NUMBER = "part-no-part-number",
    PART_NO_DESCRIPTION = "part-no-description",
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

interface DesignCheckOut {
    elementType: ElementType;
    /** Errors first, then warnings, then info. */
    issues: DesignIssue[];
    /** Onshape reported no sketch's definition, so under-defined sketches went unchecked. */
    sketchStatusUnknown: boolean;
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
// Runs when the page opens on a tab with no check cached, then only when asked.
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

`src/frontend/routes/app/design-check.tsx` and
`src/frontend/features/design-check/components/design-check-results.tsx`

```ts
function DesignCheckResults(props: DesignCheckResultsProps): ReactNode;

interface DesignCheckResultsProps {
    target: TargetElement;
    result: DesignCheckOut;
}
```

## The checks

Severity follows from the type alone (`getDesignIssueSeverity`).

| Type                                                               | Severity               | Raised for                                                                                                |
| ------------------------------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `SKETCH_UNDERDEFINED` / `SKETCH_OVERDEFINED`                       | Warning / Error        | An unsuppressed sketch Onshape reports so                                                                 |
| `ORIGIN_CUBE_MISSING` / `ORIGIN_CUBE_NOT_FIRST`                    | Warning / Warning      | A Part Studio with no Origin Cube, or with it below the first feature                                     |
| `ORIGIN_CUBE_SUPPRESSED`                                           | Error                  | The Origin Cube suppressed                                                                                |
| `FEATURE_ERROR` / `FEATURE_WARNING` / `FEATURE_SUPPRESSED`         | Error / Warning / Info | A feature or mate Onshape marks red or yellow, or one left suppressed; never the Origin Cube for the last |
| `ROLLBACK_NOT_AT_END`                                              | Warning                | A Part Studio's rollback bar above its last feature                                                       |
| `PART_NO_MATERIAL` / `PART_NO_PART_NUMBER` / `PART_NO_DESCRIPTION` | Warning / Info / Info  | A solid part missing one, the Origin Cube's own cube aside                                                |
| `INSTANCE_FIXED`                                                   | Warning                | A top-level instance that is fixed                                                                        |
| `INSTANCE_FLOATING`                                                | Warning                | A top-level instance no unsuppressed mate or group holds and no pattern copies, broken ones aside         |
| `INSTANCE_BROKEN`                                                  | Error                  | An instance Onshape sends with only its name and id, or a part instance with an empty part id             |

The assembly is read without non-solid instances, so an inserted sketch is
never checked.

The Origin Cube is FRCDesign's FeatureScript
(https://frcdesign.org/best-practices/assembly-setup/), known by its document
id in the feature's `namespace`, or by a name starting "Origin Cube" for a copy
kept in another document and renamed. Onshape sends its name as the unfilled
template `#_name`, so its issues call it "Origin Cube". Its cube is known by its
part name, "Origin Cube".

## Storage

Nothing of its own on the server: a check is answered and forgotten. Each one
is recorded as a `design_check` event, with the kind of tab and how many of
each issue type it found, and no document ([analytics.md](./analytics.md)).

**Query cache** the last check of each tab, never stale, dropped five minutes
after the page closes (TanStack's default), so coming back later checks again.

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

1. Opening the page on a tab with no check in the cache asks
   `GET /api/design-check`, signed in. Signed out, the page asks them to sign
   in instead.
2. The route reads the tab's snapshot as the caller, in the default
   configuration, all calls at once. If the sketches can't be listed for any
   reason but Onshape refusing the caller, the check goes on without their
   status and says so.
3. `checkDesign` raises the issues and sorts them worst first. An over-defined
   sketch, and an Origin Cube below the first feature, are each reported once,
   as themselves, rather than also as the warning they raise.
4. The route records the check through `trackDesignCheck`, in the background,
   and answers.
5. The navbar's refresh button, **Check again**, asks again; nothing else does.

### The results

1. With nothing found, the page says so for the kind of tab it is.
2. Otherwise the severity badges head the page, beside the time of the check,
   then one tinted box per issue type, worst first: its name, what to do about
   it, and every feature, part or instance it was found on.
3. Clicking a feature or mate's name opens it in Onshape's feature dialog
   (`sendOpenFeatureMessage`); a suppressed Part Studio feature, which Onshape
   won't open, is named only. Clicking a part's or a part instance's selects
   it in the Onshape window (`sendSelectPartMessage`): a part by its id, an
   instance by its id and its part's. A broken instance is named only.

## User-facing strings

In [strings/design-check.md](../strings/design-check.md).

## Invariants

- A check is never stored: what the page shows is what Onshape answered when
  the caller last asked.
- A check reads Onshape as the caller (`getOnshapeApi`), behind
  `requireSignInMiddleware`, so it reaches only what they can read.
- A check runs when the page opens on a tab with no check cached and on
  **Check again**, never on its own: the query is never stale and never
  retried.
- Severity follows from the type alone; it is not sent.
- `checkDesign` is pure, so every check is tested without Onshape.
- A sketch's definition status failing to arrive fails no other check; Onshape
  refusing the caller fails the whole check.
- Analytics records no document, element or name from a check.

## Failure and recovery

| What goes wrong                              | Shows as                                                         | Put right by    |
| -------------------------------------------- | ---------------------------------------------------------------- | --------------- |
| Signed out                                   | The sign-in notice                                               | **Sign in**     |
| Onshape refuses or rate-limits the caller    | "Failed to check this tab.", with **Send a report**              | **Check again** |
| Any other call fails or times out            | The same                                                         | **Check again** |
| A feature is missing a selection, and builds | Nothing: Onshape reports it `OK`; its own list shows the warning | —               |
| The sketches can't be listed                 | The other issues, and a note that sketches went unchecked        | **Check again** |
| Onshape stops sending `sketchSolveStatus`    | The note that sketches went unchecked, on every Part Studio      | A change here   |

## Decisions

- **Asked for, never automatic.** Each check spends three calls of the caller's
  Onshape allocation on a Part Studio and two on an Assembly, one of them the
  assembly definition, the scarcest ([ONSHAPE.md](../ONSHAPE.md)). Refetching on
  focus or a timer would spend them unseen.
- **Not stored, unlike build issues.** A tab changes with every edit, so a
  stored result is out of date as soon as it is written; the library's
  documents change only when a version is loaded.
- **The default configuration.** The launch doesn't carry the configuration
  showing, so a configured tab is checked as its defaults.
- **Workspaces only.** A version can't be edited, so there is nothing to act on.
- **One severity per type, the same for everyone.** Per-person levels would need
  settings and storage of their own; the severities here are the ones
  FRCDesign recommends to anybody.
- **A missing Origin Cube is a warning.** Not every Part Studio goes into a
  robot assembly: a COTS part's needs none.
- **Part number and description are info.** How a team numbers and describes its
  parts for a bill of materials is its own convention.
- **A part is selected through the part it shows.** Onshape needs the part's
  id to select anything; an instance's occurrence path only says which
  instance to look in ([ONSHAPE.md](../ONSHAPE.md)). A broken instance has no
  part left, so it is named only. A selection cancels any selection request
  outstanding, and the page makes none.
- **Grouped by type.** A Part Studio of thirty parts with no part number is one
  box listing thirty names, not thirty boxes.

_Last reviewed: 2026-11-10_
