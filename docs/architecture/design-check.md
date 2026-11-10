# Design check

## Purpose

Checking the Part Studio or Assembly the app was launched in against
FRCDesign's practices, and listing what it breaks: under- and over-defined
sketches, a missing or misplaced Origin Cube, red, yellow and suppressed
features or mates, a rollback bar left above the end, parts without a material,
part number or description, and fixed, floating or broken assembly instances.
Anybody signed in can run it on a tab they can read, and set for their account
how loud each kind of issue is, or turn it off.

It is not the library's build check ([build-issues.md](./build-issues.md)),
which checks the library's own documents when they load and shows editors what
it stores. A design check reads somebody's own tab when they ask, keeps no
result, and shows only them. It borrows the build check's severities and its
severity badges, so the two read alike.

## Code map

In the order a check runs: asked, read, checked, drawn; then the levels it is
drawn at.

`src/backend/features/design-check/routes.ts`

```text
GET /api/design-check?documentId=&instanceId=&elementId=&elementType=    DesignCheckOut; never cached
GET /api/design-check/levels                                             DesignCheckLevelsOut; never cached
POST /api/design-check/levels   { levels }                               DesignCheckLevelsOut; replaces the caller's
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
    /** Worst first at FRCDesign's levels, those off by default last. */
    issues: DesignIssue[];
    /** Unsuppressed sketches exist and Onshape reported none's status. */
    sketchStatusUnknown: boolean;
}
```

`src/backend/features/design-check/contract.ts`, a leaf module the frontend
also imports

```ts
// FRCDesign's, which a person's levels may change; it may be off.
function getDefaultLevel(type: DesignIssueType): DesignIssueLevel;
function getDesignIssueLevel(
    type: DesignIssueType,
    levels: DesignIssueLevels
): DesignIssueLevel;
// Undefined once the type is turned off.
function getShownSeverity(
    type: DesignIssueType,
    levels: DesignIssueLevels
): BuildIssueSeverity | undefined;
// Worst first, and off last.
function compareLevel(a: DesignIssueLevel, b: DesignIssueLevel): number;
// Whether the person picked other than FRCDesign's level.
function isLevelChanged(
    type: DesignIssueType,
    levels: DesignIssueLevels
): boolean;
// What analytics records of a check.
function countDesignIssues(issues: DesignIssue[]): DesignIssueCounts;
// What analytics calls a clean check: nothing found that FRCDesign's levels show.
function isCleanAtDefaults(counts: DesignIssueCounts): boolean;

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
    /** Every issue found, worst first at FRCDesign's levels, those off by default last. */
    issues: DesignIssue[];
    /** Onshape reported no sketch's definition, so under-defined sketches went unchecked. */
    sketchStatusUnknown: boolean;
    /** Epoch ms. */
    checkedAt: number;
}

/** How many of each type one check found, which analytics records. */
type DesignIssueCounts = Partial<Record<DesignIssueType, number>>;

const DESIGN_ISSUE_LEVELS = [ERROR, WARNING, INFO, "off"] as const;
type DesignIssueLevel = (typeof DESIGN_ISSUE_LEVELS)[number];
/** One person's choices; a type left out shows at FRCDesign's level. */
type DesignIssueLevels = Partial<Record<DesignIssueType, DesignIssueLevel>>;

interface DesignCheckLevelsOut {
    levels: DesignIssueLevels;
}
```

`src/backend/features/design-check/levels.ts` and
`src/backend/features/design-check/schema.ts`

```ts
// A type or level this version no longer has is dropped.
async function getLevels(db: Db, userId: string): Promise<DesignIssueLevels>;
// None left deletes the row.
async function setLevels(
    db: Db,
    userId: string,
    levels: DesignIssueLevels
): Promise<void>;
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
// The caller's levels, never stale: they change only from here.
function useDesignCheckLevelsQuery();
// Shown before the server confirms.
function useSaveDesignCheckLevelsMutation();
// Leaves out a level set back to FRCDesign's.
function withLevel(
    levels: DesignIssueLevels,
    type: DesignIssueType,
    level: DesignIssueLevel
): DesignIssueLevels;
```

`src/frontend/features/design-check/issue-text.ts`, from the messages in
`src/frontend/messages/en.json`

```ts
// One message per issue type; a type without one fails tsc.
function getDesignIssueName(type: DesignIssueType): string;
// From the first issue of its type, which carries any count.
function getDesignIssueHelp(issue: DesignIssue): string;
function getDesignIssueLevelName(level: DesignIssueLevel): string;
// The levels list's sections: both kinds of tab, Part Studios, Assemblies.
function getLevelSection(type: DesignIssueType): LevelSection;
function getLevelSectionName(section: LevelSection): string;
```

`src/frontend/routes/app/design-check.tsx` and
`src/frontend/features/design-check/components/design-check-results.tsx`

```ts
function DesignCheckResults(props: DesignCheckResultsProps): ReactNode;

interface DesignCheckResultsProps {
    target: TargetElement;
    result: DesignCheckOut;
    /** The caller's. @default FRCDesign's */
    levels?: DesignIssueLevels;
    /** Absent when the levels can't be changed, as when they couldn't be read. */
    onChangeLevels?: () => void;
}
```

`src/frontend/features/design-check/components/design-check-levels.tsx` and
`src/frontend/features/design-check/open-design-check-levels.tsx`

```ts
// Every type, by section, each at the caller's level, with a reset.
function DesignCheckLevels(): ReactNode;
function openDesignCheckLevels(): void;
```

## The checks

The defaults are FRCDesign's (`getDefaultLevel`), and turn some types off; a
person's levels can raise, lower, turn off or turn on any type, for them alone.
A type off by default is still found, sent and counted.

| Type                                                               | Default              | Raised for                                                                                                                                                                                                                  |
| ------------------------------------------------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SKETCH_UNDERDEFINED` / `SKETCH_OVERDEFINED`                       | Error / Error        | An unsuppressed sketch Onshape reports so                                                                                                                                                                                   |
| `ORIGIN_CUBE_MISSING` / `ORIGIN_CUBE_NOT_FIRST`                    | Warning / Warning    | A Part Studio with no Origin Cube, or with it below the first feature                                                                                                                                                       |
| `ORIGIN_CUBE_SUPPRESSED`                                           | Warning              | The Origin Cube suppressed                                                                                                                                                                                                  |
| `FEATURE_ERROR` / `FEATURE_WARNING` / `FEATURE_SUPPRESSED`         | Error / Error / Info | A feature or mate Onshape marks red or yellow, or one left suppressed; never the Origin Cube for the last. A built Part Studio feature is also yellow when a selection box lost one pick beside another that still resolves |
| `ROLLBACK_NOT_AT_END`                                              | Info                 | A Part Studio's rollback bar above its last feature                                                                                                                                                                         |
| `PART_NO_MATERIAL` / `PART_NO_PART_NUMBER` / `PART_NO_DESCRIPTION` | Error / Off / Off    | A solid part missing one, the Origin Cube's own cube aside                                                                                                                                                                  |
| `INSTANCE_FIXED`                                                   | Error                | An unsuppressed top-level instance that is fixed                                                                                                                                                                            |
| `INSTANCE_FLOATING`                                                | Error                | An unsuppressed top-level instance no unsuppressed mate or group holds and no pattern copies, broken ones aside                                                                                                             |
| `INSTANCE_BROKEN`                                                  | Error                | An unsuppressed instance Onshape sends with only its name and id, or a part instance with an empty part id                                                                                                                  |

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

A check is answered and forgotten. Each one is recorded as a `design_check`
event, with the kind of tab and how many of each issue type it found, and no
document ([analytics.md](./analytics.md)).

**D1** `design_check_levels` (`src/backend/features/design-check/schema.ts`):
one row per person who changed a level, keyed by Onshape user id, holding the
levels as saved and when. Kept out of `db/schema.ts`, with no foreign key: a row
names a user, not one of the app's rows. Someone on FRCDesign's levels has no
row.

**Query cache** the last check of each tab, never stale, dropped five minutes
after the page closes (TanStack's default), so coming back later checks again.
The caller's levels, never stale; a save sets them at once and reads them
again when it settles.

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
   configuration, all calls at once. A Part Studio's features are asked for
   with geometry ids, without which Onshape sends no feature's status. If the
   sketches can't be listed for any reason but Onshape refusing the caller, the
   check goes on without their status and says so.
3. `checkDesign` raises the issues and sorts them worst first. An over-defined
   sketch, and an Origin Cube below the first feature, are each reported once,
   as themselves, rather than also as the warning they raise; one that is red
   is also a feature with an error.
4. The route records the check through `trackDesignCheck`, in the background,
   and answers.
5. The navbar's refresh button, **Check again**, asks again; nothing else does.

The page asks for the caller's levels, `GET /api/design-check/levels`, beside
the check, and draws nothing until both have answered. Levels that can't be read
leave FRCDesign's and no way to change them.

### The results

Every issue shows at the caller's level for its type (`getShownSeverity`).
One the caller turned off is left out and counted; one off by default and left
so is left out unmentioned.

1. With nothing found, the page says so for the kind of tab it is; with
   everything found turned off, it says that, with how many.
2. Otherwise the severity badges head the page, beside the time of the check,
   then one tinted box per issue type, worst first at the caller's levels: its
   name, what to do about it, and every feature, part or instance it was found
   on. Under the boxes, how many the caller's levels hide, with **Change
   levels**.
3. Clicking a feature or mate's name opens it in Onshape's feature dialog
   (`sendOpenFeatureMessage`); a suppressed Part Studio feature, which Onshape
   won't open, is named only. Clicking a part's or a part instance's selects
   it in the Onshape window (`sendSelectPartMessage`): a part by its id, an
   instance by its id and its part's. A broken instance is named only.

### Levels

1. The navbar's **Levels** button, once the levels have loaded, and **Change
   levels** under the results, open `DesignCheckLevels` in a modal: every
   type, in sections by the tabs it is raised in, each with its level, and
   FRCDesign's default under one that was changed.
2. Picking a level saves every one of the caller's levels,
   `POST /api/design-check/levels`, shown at once (`withLevel`), so the page
   behind redraws without checking again. A level set back to FRCDesign's is
   left out, so it follows any change to FRCDesign's.
3. **Reset to defaults**, once anything was changed, saves none, which deletes
   the row.

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
- What a check finds, and what analytics records of it, never depends on
  anyone's levels: the server sends every issue, with no severity, and the page
  applies the caller's. A check analytics calls clean found nothing
  FRCDesign's levels show.
- Levels are the caller's alone, read and written behind
  `requireSignInMiddleware` by their user id; they cost no Onshape call.
- `checkDesign` is pure, so every check is tested without Onshape.
- A sketch's definition status failing to arrive fails no other check; Onshape
  refusing the caller fails the whole check.
- Analytics records no document, element or name from a check.

## Failure and recovery

| What goes wrong                                 | Shows as                                                    | Put right by    |
| ----------------------------------------------- | ----------------------------------------------------------- | --------------- |
| Signed out                                      | The sign-in notice                                          | **Sign in**     |
| Onshape refuses or rate-limits the caller       | "Failed to check this tab.", with **Send a report**         | **Check again** |
| Any other call fails or times out               | The same                                                    | **Check again** |
| A feature lost one of a box's picks, and builds | "Feature with a warning", though Onshape reports it `OK`    | —               |
| A feature lost every pick in a box, and builds  | Nothing: a box of default planes resolves to nothing too    | —               |
| The sketches can't be listed, or time out       | The other issues, and a note that sketches went unchecked   | **Check again** |
| Onshape stops sending `sketchSolveStatus`       | The note that sketches went unchecked, on every Part Studio | A change here   |
| The levels can't be read                        | Every issue at FRCDesign's level, and no **Levels**         | Reopening       |
| A level fails to save                           | "Failed to save your levels.", and the saved levels again   | Picking again   |

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
- **FRCDesign's levels, which each person may change for themselves.** The
  defaults are what FRCDesign recommends to anybody; a team that numbers its
  parts can turn that on, and one that keeps scrap sketches suppressed can
  quiet them. There are no team levels: a person's choices follow only them.
- **Levels applied on the page.** Changing one redraws the last check at once,
  where checking again would spend Onshape calls; and what a check finds stays
  the same for everyone, so analytics counts it the same way.
- **Levels in D1, per account.** They are a choice meant to last and to follow
  the person to another computer, which KV, for what may be lost, and browser
  storage, for one browser, are not.
- **What leaves a model wrong or an assembly loose is an error.** An
  under-defined sketch can move, a yellow feature has usually lost what it was
  built from, a part with no material weighs nothing, and a fixed or floating
  instance isn't held the way FRCDesign sets up an assembly.
- **The Origin Cube's issues are warnings.** Not every Part Studio goes into a
  robot assembly: a COTS part's needs none, and a suppressed cube matters only
  to an assembly fastened to it.
- **A suppressed feature and a rollback bar above the end are info.** Both are
  often left on purpose while working.
- **Part number and description are off.** How a team numbers and describes its
  parts for a bill of materials is its own convention, so the check stays quiet
  until someone turns them on.
- **A part is selected through the part it shows.** Onshape needs the part's
  id to select anything; an instance's occurrence path only says which
  instance to look in ([ONSHAPE.md](../ONSHAPE.md)). A broken instance has no
  part left, so it is named only. A selection cancels any selection request
  outstanding, and the page makes none.
- **A lost pick counts only beside one that still resolves.** A pick of a
  default plane resolves to nothing as well, so a box where nothing resolves
  can't be told from a sketch on Top.
- **Off by default goes unmentioned.** Part numbers and descriptions are a
  team's own convention; counting every part without one as "hidden" would leave
  nearly every Part Studio short of "No issues found". What a person turned off
  is counted, since they chose it.
- **Grouped by type.** A Part Studio of thirty parts with no part number is one
  box listing thirty names, not thirty boxes.

_Last reviewed: 2026-11-10_
