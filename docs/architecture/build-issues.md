# Build issues and the admin card

## Purpose

A load checks each group and element it saves, and stores what it finds as
**build issues**: a thumbnail that failed, a part studio with two parts, a mate
connector a configuration can suppress. Editors see them in the **admin card**,
the hover card on the status icon beside every group and element, which is also
where they change what the issues are about: visibility, insert and fasten,
indexing, a group's sort order.

It is not the load ([loading.md](./loading.md)), which decides when checks run,
nor indexing itself ([configurations.md](./configurations.md)). Users never see
an issue or the card; the library's health on the dashboard counts issues by
severity ([analytics.md](./analytics.md)).

## Code map

In the order an issue travels: raised by a check, stored, served, drawn.

`src/backend/features/build-checker/issues.ts`, a leaf module the frontend also
imports

```ts
// One issue per type, so adding one already present does nothing.
function addBuildIssue(
    issues: BuildIssue[],
    ...newIssues: BuildIssue[]
): BuildIssue[];
// Clears `types` first, so an issue the new check no longer finds doesn't stick.
function replaceBuildIssues(
    issues: BuildIssue[],
    types: BuildIssueType[],
    newIssues: BuildIssue[]
): BuildIssue[];
function clearBuildIssue(
    issues: BuildIssue[],
    ...types: BuildIssueType[]
): BuildIssue[];
function hasBuildIssue(
    issues: BuildIssue[],
    ...types: BuildIssueType[]
): boolean;
// The card links to the first offender; the rest are counted.
function toConfigurationIssue(
    type: ConfigurationIssueType,
    offenders: { values: PartialSelection }[]
): BuildIssue;
// Drops types a later deploy removed; the column applies it on every read.
function knownBuildIssues(issues: BuildIssue[]): BuildIssue[];
function getIssueSeverity(issue: BuildIssue): BuildIssueSeverity;
function getMaxSeverity(issues: BuildIssue[]): BuildIssueSeverity | undefined;
function getIssueConfiguration(issue: BuildIssue): PartialSelection | undefined;

enum BuildIssueSeverity {
    /** A potential issue that is usually fine, e.g. no vendors parsed. */
    INFO = "info",
    /** A non-critical issue that should be fixed, e.g. no thumbnail tab set. */
    WARNING = "warning",
    /** A major issue, e.g. a thumbnail failing to generate. */
    ERROR = "error"
}

enum BuildIssueType {
    THUMBNAIL_FAILED = "thumbnail-failed",
    NO_THUMBNAIL_TAB = "no-thumbnail-tab",
    NO_VENDORS = "no-vendors",
    NO_PARTS = "no-parts",
    NO_UNHIDDEN_INSERTABLES = "no-unhidden-insertables",
    CONFIGURATION_LIMIT_EXCEEDED = "configuration-limit-exceeded",
    MANUAL_INDEXING_REQUIRED = "manual-indexing-required",
    MULTIPLE_PARTS = "multiple-parts",
    CONFIGURATION_MULTIPLE_PARTS = "configuration-multiple-parts",
    UNSTABLE_COMPOSITE = "unstable-composite",
    /** The mate connector inserts use can change or break between configurations. */
    UNSTABLE_MATE_CONNECTOR = "unstable-mate-connector",
    INSERTABLES_FAILED = "insertables-failed",
    LOAD_FAILED = "load-failed",
    /** A document added but not yet loaded, until its first load saves it. */
    NOT_LOADED = "not-loaded"
}

type BuildIssue =
    | BuildIssueOf<BuildIssueType.THUMBNAIL_FAILED>
    // ...one BuildIssueOf per type, except these two:
    | ConfigurationBuildIssueOf<BuildIssueType.CONFIGURATION_MULTIPLE_PARTS>
    | ConfigurationBuildIssueOf<BuildIssueType.UNSTABLE_COMPOSITE>;

interface BuildIssueOf<T extends BuildIssueType> {
    type: T;
}

/** Raised by some configurations but not the defaults. */
interface ConfigurationBuildIssueOf<
    T extends ConfigurationIssueType
> extends BuildIssueOf<T> {
    /** The first offender's values, which the build card links out to. */
    values: PartialSelection;
    /** How many configurations raise it, that first one included. */
    configurationCount: number;
}

type ConfigurationIssueType =
    | BuildIssueType.CONFIGURATION_MULTIPLE_PARTS
    | BuildIssueType.UNSTABLE_COMPOSITE;
```

`src/backend/features/build-checker/checks.ts` and
`src/backend/features/build-checker/visibility.ts`

```ts
// Pure: the load resolves the signals.
function checkGroup(input: GroupCheckInput): BuildIssue[];
function checkInsertable(input: InsertableCheckInput): BuildIssue[];
// Re-runs the one group check that showing or hiding an insertable changes.
function checkVisibility(
    issues: BuildIssue[],
    hasVisibleInsertable: boolean
): BuildIssue[];
// Stores it on the library's groups, skipping a group with no insertables.
async function recheckVisibility(db: Db, libraryId: LibraryId): Promise<void>;

interface GroupCheckInput {
    /** Whether the Onshape document has a designated thumbnail tab/element. */
    hasThumbnailTab: boolean;
    /** The uploaded thumbnail URLs, or `null` when generation failed. */
    thumbnailUrls: ThumbnailUrls | null;
    /** Whether any of the group's insertables failed to load. */
    hasFailedInsertables: boolean;
    hasVisibleInsertable: boolean;
}

interface InsertableCheckInput {
    vendors: Vendor[];
    /** The stored thumbnail URLs, or `null` when the render has not landed. */
    thumbnailUrls: ThumbnailUrls | null;
}
```

The checks that need a probe's results live with the load:
`parseConfigurationRecords` and `decideIndexing`
(`src/backend/features/load/parse-configuration-records.ts`, owning
`INDEXING_ISSUE_TYPES`), `decideFasten`
(`src/backend/features/load/parse-fasten.ts`, owning `FASTEN_ISSUE_TYPES`), and
`LOAD_FAILED`/`NOT_LOADED` in `src/backend/features/load/flag.ts`.

`src/backend/features/build-checker/routes.ts`

```text
GET /api/build-status/library/:libraryId?v=:cacheVersion    every group's and element's status
```

`src/backend/features/library/groups/routes.ts` and
`src/backend/features/library/insertables/routes.ts`, the card's writes

```text
POST /api/set-insertable-visibility/library/:libraryId                                   then recheckVisibility
POST /api/sort-group-alphabetically/library/:libraryId
POST /api/toggle-insert-and-fasten/library/:libraryId/insertable/:insertableId           replaces FASTEN_ISSUE_TYPES
POST /api/indexing/library/:libraryId/insertable/:insertableId                           reindexes; replaces INDEXING_ISSUE_TYPES
```

`src/backend/features/build-checker/contract.ts`

```ts
interface LibraryBuildStatus {
    groups: Record<string, GroupBuildStatus>;
    insertables: Record<string, InsertableBuildStatus>;
}

interface GroupBuildStatus {
    buildIssues: BuildIssue[];
    sortAlphabetically: boolean;
    insertableOrder: string[];
    /** When Onshape cut the version this group is pinned to (epoch ms). */
    versionCreatedAt?: number;
    /** A new version waits for an editor's approval. */
    isHeld: boolean;
}

/** What an admin decided about indexing an insertable. */
interface IndexingSettings {
    /** Index even past the automatic threshold. */
    indexConfigurations: boolean;
    /** Parameters an admin left out of indexing. */
    excludedParameterIds: string[];
}

interface InsertableBuildStatus extends IndexingSettings {
    buildIssues: BuildIssue[];
    /** The version-pinned tab, so an issue can link out to a configuration of it. */
    elementPath: ElementPath;
    elementType: ElementType;
    isVisible: boolean;
    /** Inserts place and fasten at its mate connector. */
    supportsFasten: boolean;
    /** An admin turned fastening off; otherwise it is on wherever a connector is found. */
    fastenDisabled: boolean;
    vendors: Vendor[];
    /** Empty for an element without configurations. */
    parameters: ConfigurationParameter[];
    /** When Onshape cut the version this insertable is pinned to (epoch ms). */
    versionCreatedAt?: number;
}
```

`src/frontend/features/build-status/queries.ts` and
`src/frontend/features/build-status/indexing-draft.ts`

```ts
function useBuildStatusQuery();
function useSetVisibilityMutation(insertableIds: string[], isVisible: boolean);
function useToggleInsertAndFastenMutation(insertableId: string);
function useIndexingMutation(insertableId: string);
function useToggleSortOrderMutation(groupId: string);
// The stored settings with the unsaved draft laid over them.
function useIndexingView(
    insertableId: string,
    status: IndexingSettings
): IndexingView;
function editIndexingDraft(
    insertableId: string,
    status: IndexingSettings,
    edit: IndexingDraft
): void;
function clearIndexingDraft(insertableId: string): void;
// Dots the card's icon.
function useHasIndexingDraft(insertableId: string): boolean;

/** What the card shows and saves: the stored settings with the draft laid over them. */
interface IndexingView extends IndexingSettings {
    /** It differs from what is stored, so there is something to save. */
    isUnsaved: boolean;
}

/** An admin's edits, holding only what differs from what is stored. */
type IndexingDraft = Partial<IndexingSettings>;
```

`src/frontend/features/build-status/issue-text.ts`, from the messages in
`src/frontend/messages/en.json`

```ts
// One message per issue type; a type without one fails tsc.
function getIssueTitle(issue: BuildIssue): string;
function getIssueDescription(issue: BuildIssue): string | undefined;
```

`src/frontend/features/build-status/components/build-status.tsx`,
`src/frontend/features/build-status/components/card-section.tsx` and the
sections beside them

```ts
// The card, pre-wired for a row; nothing below an editor.
function InsertableStatusBadge(props: InsertableStatusBadgeProps): ReactNode;
function GroupStatusBadge(props: GroupStatusBadgeProps): ReactNode;
// The card's folding sections, on `AppSections` (`src/frontend/components/app-section.tsx`).
function CardSections(props: CardSectionsProps): ReactNode;
function CardSection(props: CardSectionProps): ReactNode;
function BuildIssueList(props: BuildIssueListProps): ReactNode;
function InsertableSettings(props: InsertableSettingsProps): ReactNode;
function GroupSettings(props: GroupSettingsProps): ReactNode;
function ConfigurationSection(props: ConfigurationSectionProps): ReactNode;
function UsageSection(props: UsageSectionProps): ReactNode;

interface InsertableStatusBadgeProps {
    insertableId: string;
    groupId: string;
    name: string;
}

interface GroupStatusBadgeProps {
    groupId: string;
    name: string;
}

interface CardSectionsProps {
    /** Each a keyed {@link CardSection}, or a component that renders one. */
    sections: ReactElement[];
}

interface CardSectionProps {
    id: SectionId;
    title: string;
    /** Beside the title, before the chevron: a link, or what the closed section holds. */
    actions?: ReactNode;
    children: ReactNode;
}

interface BuildIssueListProps {
    issues: BuildIssue[];
    /** Passed for an insertable; a group has no configurations to open. */
    configurationTarget?: ConfigurationTarget;
}

/** Undefined for an element with no configurations. */
interface ConfigurationTarget {
    elementPath: ElementPath;
    parameters: ConfigurationParameter[];
}
```

## Storage

**D1** `groups.build_issues` and `insertables.build_issues`: the issues, as
JSON, filtered through `knownBuildIssues` on every read. Written by a load, and
by the writes above. Kept until the next write replaces them.

**D1**, the settings the card edits, kept across reloads:
`insertables.is_visible`, `insertables.fasten_disabled`,
`insertables.index_configurations`, `insertables.excluded_parameter_ids`, and
`groups.sort_alphabetically`.

**HTTP cache** the build status, private to the editor, keyed by the library's
cache version, which every load and write bumps.

**Query cache** the build status per library and cache version, never stale;
the previous version stays shown while the next loads.

**Browser, in memory** unsaved indexing edits, per insertable
(`indexing-draft.ts`). Gone on reload, since a reload may change what they were
made against.

**Browser** `uiState.sections`: whether each card section is open
(`build-checks`, `settings`, `configuration`, `usage`), shared by every card;
and the settings menu's `admin-settings`. Build checks, Settings, Usage and
Admin settings start open; Configuration starts closed.

## Flows

### Raising and clearing

1. A load runs `checkInsertable` and its probe's checks on each element it
   saves, then `checkGroup` on the group, and stores both
   ([loading.md](./loading.md)). A group whose load throws keeps its issues and
   gains `LOAD_FAILED`.
2. An editor's write re-runs only the checks it can change, through
   `replaceBuildIssues` with the types it owns: showing or hiding elements runs
   `recheckVisibility`; toggling fasten replaces `FASTEN_ISSUE_TYPES`; saving
   indexing reindexes and replaces `INDEXING_ISSUE_TYPES`; reloading a
   thumbnail clears `THUMBNAIL_FAILED`.

### The card

1. The status icon beside a row shows the worst severity, a spinner while its
   group loads, or a hidden mark for a hidden element; a blue dot
   (`DotIndicator`, Mantine's `Indicator`) marks unsaved indexing edits.
2. Hovering it opens the card: name, element type, version age and severity
   badges, then the sections, each folding on its own: Mantine's unstyled
   accordion, whose whole header is the toggle, so nothing that is a control
   sits in it. A closed section is unmounted, so Usage fetches nothing until
   opened.
3. **Build checks** lists one callout per issue. One that blames a
   configuration links to it in Onshape, built from the issue's `values`
   through `toSelection`.
4. **Settings** writes at once: each toggle patches the cached status, posts,
   and refetches when it settles. Hiding asks first.
5. **Configuration** lists every parameter with its type and whether search
   indexes it; an enum's badge opens a bubble listing its options. Edits
   collect as a draft; **Discard** and **Save** show only while it differs
   from what is stored, and **Save** sends both settings in one reindex.
6. **Usage** reads the part's all-time numbers from the dashboard's parts
   report; **Open in dashboard** under them opens that part's report.

## User-facing strings

In [strings/build-issues.md](../strings/build-issues.md).

## Invariants

- Issues are stored, never computed on read. A load writes them, and a write
  re-runs only the checks it can change.
- A row holds at most one issue of each type (`addBuildIssue`).
- A re-run replaces every type it owns (`replaceBuildIssues`), so an issue the
  new check no longer finds is cleared, not left behind.
- Severity follows from the type alone (`getIssueSeverity`); it is not stored.
- A read drops types this deploy doesn't know (`knownBuildIssues`), so removing
  a check needs no migration.
- A configuration issue stores the first offender's values, as a selection,
  and its link is built from them with `toSelection`; never from a
  configuration key.
- Only editors see the card and the build status: the route sits behind
  `requireEditorMiddleware`, the card behind `RequireAccessLevel`, and the
  writes behind the same guard.
- A card section is open or closed on every card at once, and a closed one is
  unmounted, so it fetches nothing.
- Indexing edits are a draft until **Save**, which sends both settings in one
  reindex. Every other setting writes at once.
- Each write patches the cached status, then refetches when it settles; a
  failed write's patch is discarded.

## Failure and recovery

| What goes wrong                                 | Shows as                                        | Put right by                           |
| ----------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| A thumbnail never lands                         | `THUMBNAIL_FAILED`                              | **Reload thumbnail** in the row's menu |
| A load throws                                   | `LOAD_FAILED` on the group; its old issues stay | Reload the document                    |
| A document was added but its load never started | `NOT_LOADED`                                    | Reload                                 |
| A write fails                                   | Error toast; the patch is discarded on refetch  | Retry the toggle or save               |
| A reindex's probe fails                         | Error toast; nothing is written                 | Save again                             |
| A deploy removes an issue type                  | Nothing: dropped on read                        | —                                      |

## Decisions

- **Issues are stored rather than derived on read.** Most need an Onshape
  probe, which only a load can afford, and the card must open instantly.
- **A write re-runs only its own checks.** Rerunning every check would need a
  full probe; each write owns the issue types its setting can change.
- **Indexing edits are a draft; the other settings save at once.** A reindex
  probes Onshape and can take a while, so several checkbox changes should
  cost one; a switch is cheap and expected to act.
- **One open state for every card's section.** An editor checks many cards in
  a row, and wants the same sections open on each.
- **The enum options bubble opens below its badge.** The card already fills the
  space to the badge's right, and a bubble shifted over the badge would take
  the pointer off it and close both.

_Last reviewed: 2026-11-02_
