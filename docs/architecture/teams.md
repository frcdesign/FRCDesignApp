# Teams

## Purpose

A **team** is a FIRST robotics team, FRC or FTC, as one or more Onshape
**organizations** registered it. An organization is an enterprise or an
educator plan's classroom. Teams are anonymous and unverified: a team is its
own id, which claims a FIRST number, and several teams may claim one number.

A team gets:

- **Context without asking.** Work in a document a registered organization owns
  is credited to its team. Work anywhere else goes to the team the user chose.
- **Usage credited to the team** as well as the user. A members-only page ranks
  the team in every feature against the other teams of its program, anonymously,
  with gold, silver and bronze medals.
- **Team settings**, set by its admins:
    - team favorites, marked with a team icon, and whether members may edit them;
    - an order of preferred vendors;
    - team colors, offered by the Color control.
- **Shared recents**: what any member inserted in the team's context.

It is not:

- **Library editing.** A library's admin team (see [auth.md](./auth.md)) is an
  Onshape team that decides who edits a library. Nothing here grants a library
  access level. In this document and its code, "team" means a FIRST team.
- **An account system.** Membership and roles are inherited from Onshape:
  editing an organization's documents makes a member, administering the
  organization or its Onshape team makes an admin. Nobody edits them here.
- **A roster.** The app knows a member only by Onshape user id, and shows
  admins only counts.

## Code map

In the order a team comes to be and is used.

`src/backend/features/teams/first-teams.ts`, run by the weekly cron

```ts
// Each program whose FIRST API credentials are set; one failing leaves the other's.
async function refreshFirstTeams(env: AppBindings, now?: Date): Promise<void>;
function upsertTeams(
    db: Db,
    program: Program,
    season: number,
    teams: FirstApiTeam[]
): Promise<void>;
```

`src/backend/features/teams/register.ts`, the one flow that calls Onshape

```ts
// Returns the team the organization joined.
async function registerOrganization(
    c: AppContext,
    request: RegisterTeamIn
): Promise<string>;
// Refused unless the organization owns the Onshape team.
async function readSubteam(
    api: OAuthApi,
    subteamId: string,
    companyId: string
): Promise<string[]>;
```

`src/backend/features/teams/membership.ts`, called by `/init`

```ts
function toDocumentOwner(
    document: OnshapeDocumentInfo
): DocumentOwner | undefined;
// Never throws: a launch opens the app whatever happens to its record.
async function recordLaunch(
    c: AppContext,
    document: OnshapeDocumentInfo
): Promise<void>;
```

`src/backend/features/teams/context.ts`

```ts
interface TeamContext {
    teamId: string;
    source: TeamContextSource;
}

async function resolveTeamContext(
    env: AppBindings,
    userId: string,
    documentId: string | undefined
): Promise<TeamContext | undefined>;
// For tracking and recents: a failure credits no team.
async function creditedTeamId(
    env: AppBindings,
    userId: string,
    documentId: string | undefined
): Promise<string | null>;
```

`src/backend/features/teams/store.ts`

```ts
/** Who owns a document: a company, or a person (`cad`, `PERSONAL_COMPANY_ID`). */
interface DocumentOwner {
    companyId: string;
    /** Undefined for a person. */
    kind?: OrganizationKind;
}

const documentOwnerStore: KvStore<DocumentOwner>;
/** A team id, or `PERSONAL`. */
const chosenTeamStore: KvStore<string>;

async function getMyTeams(db: Db, userId: string): Promise<MyTeam[]>;
// Joins a member, or moves an existing one's last seen; never changes a role.
function upsertMember(
    db: Db,
    teamId: string,
    userId: string,
    role: TeamRole,
    now: Date
);
```

`src/backend/features/teams/guards.ts`

```ts
function teamRoute(): string; // "/teams/:teamId"
const requireTeamMemberMiddleware: MiddlewareHandler<AppContextEnv>;
const requireTeamAdminMiddleware: MiddlewareHandler<AppContextEnv>;
// An admin, or a member while `members_edit_favorites` is on.
const requireTeamFavoritesEditorMiddleware: MiddlewareHandler<AppContextEnv>;
```

`src/backend/features/teams/routes.ts` and `favorites.ts`

```text
GET    /api/teams/context?documentId=                             TeamContextOut
GET    /api/teams/first?program=&q=                               FirstTeam[], by number or name
POST   /api/teams/register                                        RegisterTeamIn → { teamId }
POST   /api/teams/chosen                                          { teamId?: string | "personal" }
POST   /api/teams/refresh-first                                   owner
GET    /api/teams/:teamId/admin                                   admin: TeamAdminOut
POST   /api/teams/:teamId/settings                                admin: Partial<TeamSettings>
DELETE /api/teams/:teamId/organizations/:organizationId           admin
POST   /api/teams/:teamId/organizations/:organizationId/refresh   admin: syncs a subteam
GET    /api/teams/:teamId/favorites/library/:libraryId            member: FavoritesData
POST   /api/teams/:teamId/favorites/library/:libraryId?insertableId=&id=   favorites editor
DELETE /api/teams/:teamId/favorites/:favoriteId                   favorites editor
POST   /api/teams/:teamId/favorite-order/library/:libraryId       favorites editor
GET    /api/teams/:teamId/recents/library/:libraryId              member: RecentsData
GET    /api/teams/:teamId/report                                  member: TeamReportOut
```

`src/backend/features/teams/recents.ts`

```ts
// As a user's: to the front, then trimmed to `MAX_TEAM_RECENTS`.
async function writeTeamRecentInsert(
    db: Db,
    teamId: string,
    userId: string,
    event: RecentInsertEvent,
    insertedAt: Date
): Promise<void>;
```

`src/backend/features/teams/report.ts`

```ts
/** September to August: a team's year spans either program's season and its build. */
interface TeamYear {
    from: string;
    to: string;
    /** "2026–27". */
    label: string;
}

function teamYear(day: string): TeamYear;
// Undefined below `MIN_RANKED_TEAMS`, or for a team that never used the category.
function rank(value: number, values: number[]): TeamStanding["ranking"];
async function getTeamReport(
    db: Db,
    teamId: string,
    today: string
): Promise<TeamReportOut | undefined>;
```

`src/backend/features/teams/vendor-policy.ts`, a leaf the insert menu shares
with `readSelection`

```ts
// Each Vendor parameter held to the policy; on `opening` a part at its
// defaults, an untouched Vendor also takes the team's preference.
function applyVendorPreferences(
    selection: Selection,
    parameters: ConfigurationParameter[],
    preferences: VendorPreferences,
    opening: boolean
): Selection;
// Undefined to hide it: under Require, or where Ban leaves one option.
function offeredVendorParameter(
    parameter: ConfigurationParameter,
    generic: GenericVendorPolicy
): ConfigurationParameter | undefined;
```

`src/backend/features/teams/context.ts` also has

```ts
// The caller's team's, in that document; `NO_PREFERENCES` off a team or on failure.
async function vendorPreferencesFor(
    env: AppBindings,
    userId: string,
    documentId: string | undefined
): Promise<VendorPreferences>;
```

`src/backend/features/teams/contract.ts`, a leaf the frontend imports

```ts
enum TeamRole {
    ADMIN = "admin",
    MEMBER = "member"
}

/** Which kind of Onshape company an organization is; see ONSHAPE.md. */
enum OrganizationKind {
    ENTERPRISE = "enterprise",
    CLASSROOM = "classroom"
}

/** Why a use is credited to the team it is. */
enum TeamContextSource {
    /** The document's organization registered the team, and the user is its member. */
    DOCUMENT = "document",
    /** The user's choice, for a document no team of theirs owns, or no document. */
    CHOSEN = "chosen"
}

/** Who chose Personal: their uses count toward no team until they choose one. */
const PERSONAL = "personal";
const MAX_TEAM_COLORS = 6;
const MAX_TEAM_FAVORITES = 250;
const MAX_TEAM_RECENTS = 100;
/** A ranking means nothing among fewer teams, and would point at one. */
const MIN_RANKED_TEAMS = 10;

/** A team as FIRST lists it. */
interface FirstTeam {
    program: Program;
    number: number;
    /** FIRST's short name, such as "The Cheesy Poofs". */
    name: string;
    city?: string;
    stateProvince?: string;
    country?: string;
}

interface TeamSettings {
    /** Whether members, not only admins, may add, order and remove team favorites. */
    membersEditFavorites: boolean;
    /** Most preferred first; a vendor left out ranks after every listed one. */
    vendorRanking: Vendor[];
    /** `#rrggbb`, in the order offered. At most `MAX_TEAM_COLORS`. */
    colors: string[];
    genericVendor: GenericVendorPolicy;
}

/** What the current team asks of vendors; `NO_PREFERENCES` off a team. */
interface VendorPreferences {
    ranking: Vendor[];
    generic: GenericVendorPolicy;
}

/** How Vendor lists and Auto Assembly treat the Generic vendor, which sells every standard length without part numbers. */
enum GenericVendorPolicy {
    /** Always Generic; the vendor inputs are hidden. */
    REQUIRE = "require",
    /** Generic until somebody picks another. */
    PREFER = "prefer",
    /** The vendor ranking decides, as for any vendor. */
    ANY = "any",
    /** The best-ranked other vendor until somebody picks Generic. */
    AVOID = "avoid",
    /** Never Generic; it is left out of the vendor inputs. */
    BAN = "ban"
}

/** One of the caller's teams. A team is its own id: several may claim one FIRST number. */
interface MyTeam {
    id: string;
    first: FirstTeam;
    role: TeamRole;
    settings: TeamSettings;
}

/** The organization that owns the launch's document, as the server knows it. */
interface DocumentOrganization {
    companyId: string;
    kind: OrganizationKind;
    /** Undefined until somebody registers it, which asks Onshape for its name. */
    name?: string;
    /** The teams it registered, the caller's or not. */
    teams: { id: string; first: FirstTeam }[];
}

/** `GET /api/teams/context`: everything the app shows about teams. */
interface TeamContextOut {
    teams: MyTeam[];
    /** The team uses are credited to now; undefined for none. */
    current?: { teamId: string; source: TeamContextSource };
    /** A team id or `PERSONAL`: the caller's choice for documents no team of theirs owns. Undefined for the default. */
    chosen?: string;
    /** Set when the document belongs to a company; undefined for a personal one or none. */
    organization?: DocumentOrganization;
}

interface RegisterTeamIn {
    /** The launch's document, whose owner is the organization registered. */
    documentId: string;
    /** An Onshape team in the organization, whose members alone join; omitted for every editor. */
    subteamId?: string;
    /** A FIRST team, for a new team; omitted with `teamId`. */
    first?: { program: Program; number: number };
    /** One of the caller's teams the organization joins, as its admin. */
    teamId?: string;
}

/** What a team is ranked in: every use, and each feature's. */
type TeamCategory = typeof ALL_USES | AppFeature;
const ALL_USES = "uses";
// Every use, and each feature but the four lists one person keeps for themselves:
// favorites, recents, and their team counterparts.
const TEAM_CATEGORIES: TeamCategory[];

enum Medal {
    GOLD = "gold",
    SILVER = "silver",
    BRONZE = "bronze"
}

/** One category's standing; the other teams stay anonymous. */
interface TeamStanding {
    category: TeamCategory;
    uses: number;
    /** Over the team's active members this year. */
    usesPerMember: number;
    /** Undefined while fewer than `MIN_RANKED_TEAMS` used the category this year. */
    ranking?: {
        /** "Top 4%": the share of ranked teams at or above this team, rounded up. */
        topPercent: number;
        medal?: Medal;
        /** Every ranked team's uses per member, binned; no bin names a team. */
        distribution: Histogram;
        /** This team's bin in `distribution`. */
        teamBin: number;
    };
}

interface TeamReportOut {
    first: FirstTeam;
    /** "2026–27": September to August, which spans either program's season. */
    year: string;
    activeMembers: number;
    standings: TeamStanding[];
}
```

`TeamOrganizationOut` and `TeamAdminOut`, its organizations and its member and
admin counts, are the admin view's. `Program` is `analytics/seasons.ts`'s.

`src/frontend/features/teams/`

```ts
// queries.ts
function useTeamContextQuery(); // keyed by the launch's document
function useCurrentTeam(): MyTeam | undefined;
function useCurrentTeamSettings(): TeamSettings | undefined;
function useCanEditTeamFavorites(): boolean;
// color.ts: one Color in place of a part's channels or text color
function findColorControl(
    parameters: ConfigurationParameter[]
): ColorControl | undefined;
function readColor(
    control: ColorControl,
    selection: Selection
): string | undefined;
function writeColor(
    control: ColorControl,
    selection: Selection,
    hex: string
): Selection;
// vendor-ranking.ts
function orderVendors(vendors: Vendor[], ranking: Vendor[]): Vendor[];
function preferredVendor(
    candidates: NamedVendor[],
    ranking: Vendor[]
): NamedVendor | undefined;
function breakTiesByVendor<T>(
    items: T[],
    vendorsOf: (item: T) => Vendor[],
    isTie: (a: T, b: T) => boolean,
    ranking: Vendor[]
): T[];
```

| Path                                                            | Role                                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/frontend/features/teams/components/team-settings.tsx`      | The settings menu's team rows and the team admin's settings |
| `src/frontend/features/teams/components/register-team-form.tsx` | **Register team**: a new team, or the caller's              |
| `src/frontend/features/teams/components/team-favorites.tsx`     | Team favorite rows, the team icon, and the part menu's item |
| `src/frontend/features/teams/components/color-row.tsx`          | The Color control                                           |
| `src/frontend/features/recents/components/recents-list.tsx`     | **Mine** and **Team** on Recently Used                      |
| `src/frontend/routes/dashboard/teams/$teamId.tsx`               | The team's page                                             |

## Storage

**D1**, in `db/schema.ts`, since team favorites and recents reference
insertables:

- `first_teams` — FIRST's lists: program, number, name, city, state or
  province, country, rookie year, and the latest season FIRST listed it in.
  Primary key on program and number. A team FIRST stops listing keeps its row.
- `teams` — a registered team: its id, the program and number it claims,
  `members_edit_favorites`, `vendor_ranking`, `colors` and `generic_vendor`,
  and who registered
  it when. Several rows may claim one number.
- `team_organizations` — one organization registered to one team: its company
  id and kind, the name Onshape gave it, and `subteam_id` with
  `subteam_members` (each member's id and whether they administer it, as last
  read) and `synced_at`. An empty `subteam_id` means every editor. Unique on
  company and subteam, and on team and company.
- `team_members` — a cache of what Onshape says: team, user, role,
  `joined_at`, `last_seen_at` and `role_checked_at`. A row counts only while
  `last_seen_at` is within `MEMBERSHIP_DAYS` (90). Primary key on team and
  user; indexed on user.
- `team_favorites` — a user's favorite's shape, owned by a team, with
  `created_by`. Unique on team, library and insertable.
- `team_recent_inserts` — a user's recent's shape, owned by a team, with who
  last inserted it. Unique on team, insertable and selection. At most
  `MAX_TEAM_RECENTS` rows per team and library.

Deleting a team cascades to all four of its tables. Deleting an insertable
deletes its team favorites and recents, and hiding one deletes them too.

**D1**, in `features/analytics/schema.ts`: `events.team_id`, and the
`daily_team_metrics` and `daily_team_users` rollups (see
[analytics.md](./analytics.md)).

**KV**:

- `document-owner:` — by document id, its `DocumentOwner`. Written by `/init`
  and by registration; 30 days.
- `chosen-team:` — by user id, the team chosen or `personal`. Kept until
  changed.

**Secrets**: `FIRST_FRC_API_USERNAME`, `FIRST_FRC_API_TOKEN`,
`FIRST_FTC_API_USERNAME`, `FIRST_FTC_API_TOKEN` (see [auth.md](./auth.md)).

**Cron**: `17 7 * * 1`, weekly, in `wrangler.jsonc`'s `triggers`, inherited by
every environment. The Worker's `scheduled` handler runs `refreshFirstTeams`.

**Browser** `uiState.showTeamRecents`: whether Recently Used shows the team's
list. `uiState.sections` holds Team settings' open state.

## Flows

### Refreshing FIRST's lists

1. The cron, or the owner's **Refresh** beside **FIRST teams**, calls
   `refreshFirstTeams`.
2. For each program with credentials, it pages FIRST's Events API with basic
   auth: `frc-api.firstinspires.org/v3.0/{season}/teams` and
   `ftc-api.firstinspires.org/v2.0/{season}/teams`.
3. FRC numbers a season by the year it competes in, so from September it reads
   this year's and next year's. FTC numbers one by the year it starts.
4. Each page is upserted in one D1 batch. `last_season` keeps the larger season.
5. A program without credentials is skipped and logged. A page FIRST refuses
   stops that program; what it wrote stays.

### Registering an organization

1. The settings menu shows **Register team** under **Organization** whenever the
   launch's document belongs to a company the server knows of.
2. The form registers it to a new team, picked from FIRST's list by number or
   name, or to a team the caller administers. An Onshape team link or id is
   optional.
3. `registerOrganization` reads the document (`getDocument`). A document no
   company owns is refused.
4. It reads the company (`getCompany`). Anyone but its admin is refused.
5. With an Onshape team, `readSubteam` checks the company owns it and reads its
   members.
6. A company and subteam already registered is refused, as is a company already
   on the chosen team. A new team's number must be in `first_teams`.
7. One batch writes the team when new, the organization, and the caller as the
   team's admin.

### Becoming a member

1. `/init` reads the launch's document in `checkLaunchDocument`.
2. `recordLaunch` saves its owner under `document-owner:`.
3. When a company owns it and the grant has `WRITE`, `joinOrganizationTeams`
   takes each team the company registered.
4. A subteam's members read more than `ONSHAPE_RECHECK_HOURS` (24) ago are
   read again under the caller's session (`readSubteam`). If Onshape won't say,
   the stored members stand.
5. The caller joins every team registered for all the company's editors, and
   each subteam's they are in. Joining moves `last_seen_at` to now.
6. Their role is inherited. An admin of the company (`getCompany`'s `admin`) or
   of the subteam is the team's admin; anyone else is a member. The company is
   asked once a day: while every one of the caller's memberships here was
   checked within `ONSHAPE_RECHECK_HOURS`, the stored roles stand, and so they
   do when Onshape won't say.
7. A membership no launch proves again within `MEMBERSHIP_DAYS` lapses: no
   read counts it.
8. Registration writes its registrant as an admin, since it just checked.
   **Refresh members** beside a subteam re-reads it under the admin's session.
   Nothing else writes membership or a role.

### Team context

`resolveTeamContext` decides it, for the caller and a document:

1. A user on no team has none.
2. When `document-owner:` names a company that registered teams the user is on,
   the document decides: the chosen team if it is among them, else the one last
   seen.
3. Otherwise a `personal` choice gives none.
4. Otherwise the chosen team, if the user is still on it, else the one last
   seen. Nobody starts on Personal.

The settings menu's **Team** select lists the user's teams, and **Personal**
outside a team's document. In a team's document it is disabled, and says "Set
by this document".

### Usage and the team page

1. Every tracker resolves the team in the background (`creditedTeamId`) from the
   document the work went into. A download, a report and a default
   configuration have none, so they go to the chosen team.
2. `rollupWrites` adds an event with a team to `daily_team_users`, and to
   `daily_team_metrics` for each feature `featuresOf` gives, plus `uses` for a
   use. Every other rollup is written as before.
3. `/dashboard/teams/:teamId`, linked from **Team dashboard**, shows the team's
   year, September to August (`teamYear`): its uses, active members, and a card
   per category in `TEAM_CATEGORIES`, ranked ones first. The favorites and
   recents lists aren't ranked: keeping a list isn't something a team does
   better or worse.
4. A category's value is the team's count over its active members that year.
   It is ranked among every team of the program with any use of it. Below
   `MIN_RANKED_TEAMS` such teams it says when it will be ranked instead.
5. A ranking is "Top N%": the share of ranked teams at or above this one,
   rounded up. Ties share the best rank. The top 10% are gold, to 25% silver,
   to 50% bronze, each a medal icon in its metal's color.
6. A ranked card draws every ranked team's uses per member as a histogram
   (`toHistogram`, `analytics/histogram.ts`), the team's own share of its bar
   apart under **Your team**. Bins count teams; none names one.

### Team favorites

1. The Favorites list shows the current team's favorites first, each with the
   team icon, then the user's own. A part in both shows once, as the team's.
2. A part's menu offers **Add to team favorites** or **Remove from team
   favorites** to an admin, or a member while the team allows it. So does a
   team favorite's menu, with reordering.
3. A team favorite opens and quick-inserts with `UseSource.TEAM_FAVORITES`.

### Shared recents

1. `recordRecentInsert` writes the user's recent, then the team's when the
   insert has a team, after the insert succeeded. Neither failing fails it.
2. On a team, Recently Used offers **Mine** and **Team**. Team lists what any
   member inserted in that team's context, newest first, with
   `UseSource.TEAM_RECENTS`.

### Vendor ranking

The current team's `vendor_ranking`:

- orders the vendor filter menu, ranked vendors first;
- breaks ties between search results of equal score, the better-ranked vendor
  first (`breakTiesByVendor`);
- picks Auto Assembly's screw vendor, below.

A ranking never hides a part.

### Auto Assembly vendors

`settleChoices` takes the team's `VendorPreferences` and decides the screw's
vendor before settling the rest. Washers and nuts follow the screw's vendor,
as always. The team's **Generic fasteners** setting (`GenericVendorPolicy`)
says how:

| Setting           | Screw vendor                                                       | Vendor inputs                                     |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| **Require**       | Always Generic, whatever was picked                                | Hidden, screw's and parts' alike                  |
| **Prefer**        | Generic until somebody picks another                               | Shown                                             |
| **No preference** | The best-ranked vendor making screws until somebody picks one      | Shown                                             |
| **Avoid**         | The best-ranked other vendor until somebody picks one, Generic too | Shown                                             |
| **Ban**           | Never Generic: a pick of it moves to the best-ranked other vendor  | Generic left out; hidden where one vendor remains |

Under **Ban** a washer or nut settled onto Generic moves to the first other
vendor making it in the screw's size. With none, that part isn't offered.
Where the ranking names none of the catalog's vendors, the catalog's first
other vendor stands in.

A catalog's vendor is a library's when its id or name matches the library
vendor's code or name, ignoring case and punctuation (`preferredVendor`), so
`MCMASTER` and "McMaster-Carr" are `MCM`.

### Vendor dropdowns

Every other Vendor list, a parameter with `ParameterRole.VENDOR`, follows the
same setting, through `features/teams/vendor-policy.ts`:

- **Require** sets it to Generic and hides it, where it offers Generic.
- **Ban** moves it off Generic, to the best-ranked other option, and leaves
  Generic out of its options. One option left, it is hidden.
- A part opened at its defaults, with nothing chosen, from a list or a quick
  insert, also takes the team's preference for a Vendor still at its default:
  Generic under **Prefer**, the best-ranked other option under **Avoid**, the
  best-ranked option under **No preference**. A ranking naming none of its
  options leaves the default.

`readSelection` applies it on the server to every insert and download, with
the caller's team in the target document (`vendorPreferencesFor`), so a quick
insert follows it too. The insert menu applies the same functions, so what it
shows is what is inserted. The menu never waits for the team: it renders at
once, and a preference arriving later still fills a Vendor nobody edited.

An option names a vendor by `readVendorOption` (`library/vendor-options.ts`):
its exact name, Generic, the vendor's code, or a near spelling. The load warns
of every option that isn't exact or Generic (see
[build-issues.md](./build-issues.md)).

### The Color control

The configuration inputs show one **Color** in place of three channel
parameters (`ParameterRole.COLOR_CHANNEL`, red, green and blue) or a text
color parameter (`ParameterRole.COLOR`). On a team with colors it offers them,
then **Custom**. Custom, or any part off a team, shows a color input that takes
hex or RGB. Picking writes each channel, scaled 0–255 or 0–1 by its maximum, or
the text as `#rrggbb`. A color parameter with named options keeps its own
list.

## User-facing strings

[docs/strings/teams.md](../strings/teams.md).

## Invariants

- A company and subteam belong to at most one team; a company joins a team at
  most once.
- Only a company's admin, as Onshape reports it, registers that company.
- Membership and roles come only from Onshape: written by `/init`, from a
  document the grant can write and a registered company owns, and by
  registration. No route sets a role or a member.
- A team's admin administers one of its organizations or its Onshape team, as
  Onshape last said within a day of their latest launch.
- A membership counts only while a launch proved it within `MEMBERSHIP_DAYS`.
- `resolveTeamContext` is the one place that decides a use's team.
- A use is credited to a team only while the user is its member.
- Team context never changes what a request does, only where it is counted.
  Resolving it never fails a request: a failure gives no team.
- No team route but registration and **Refresh members** calls Onshape. A
  launch asks Onshape about a role or a subteam at most once a day each.
- Team favorites, recents and the report are read only by the team's members.
- The report never names another team, and never ranks or draws a distribution
  among fewer than `MIN_RANKED_TEAMS`.
- No route lists a team's members; admins see counts.
- Every global rollup counts a use the same with a team or without.
- Every team rollup is derivable from `events` alone.
- Vendor ranking orders results; it never filters them.
- Under **Require** no inserted part's Vendor, nor Auto Assembly's, is anything
  but Generic where Generic is offered; under **Ban** none is Generic where
  another is offered. The server holds it, not only the menu.
- A team's vendor preference never changes a vendor somebody chose, a
  favorite's or recent's, or a search hit's.

## Failure and recovery

| Failure                                            | Result                                                   | Recovery                                  |
| -------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------- |
| FIRST's API refuses or is down                     | That program's refresh stops; last week's list stays     | The next run, or **Refresh** as the owner |
| A team is new and not yet listed                   | It can't be registered                                   | The next refresh                          |
| No FIRST credentials                               | The refresh skips the program                            | Set the secrets                           |
| `document-owner:` expired for a document           | Uses there go to the chosen team                         | The next launch from that document        |
| Onshape won't say the caller administers a company | Registration refused                                     | A company admin registers it              |
| A member leaves the organization                   | They stay a member until 90 days after their last launch | Automatic                                 |
| An admin stops administering the company           | They stay an admin until their next launch a day on      | Automatic                                 |
| Onshape won't say who administers a company        | Stored roles stand                                       | The next launch a day on                  |
| Someone registers the wrong team number            | Its members' uses are credited to that team              | The team's admin removes the organization |

## Decisions

- **Teams are anonymous and unverified.** Nothing proves an organization is the
  team it claims, and nothing needs to: no team sees another, so a false claim
  only misplaces its own numbers. A team is a UUID so two claims of one number
  stay apart.
- **Registration needs a company admin.** Anyone who edits a school's documents
  could otherwise point the whole school at a team. Onshape's company record
  says who administers it, at one call per registration.
- **Membership from launches, not Onshape's member lists.** `/init` already
  reads the document's owner and the caller's permissions, so a member is
  proven by editing the organization's work at no extra call. Listing a
  company's members needs an admin's session on every sync.
- **Roles inherited from Onshape, not set here.** The people who run a school's
  Onshape already decide who administers it; mirroring that keeps one place to
  change it and needs no member list. A role is cached and asked again once a
  day, so a launch costs at most one extra call a day.
- **Memberships lapse after 90 days.** A student who left stops counting with
  nobody removing them; a season's break is shorter.
- **A subteam narrows an organization.** A school enterprise often holds an FRC
  and an FTC team. Its documents are the enterprise's, never a subteam's, so the
  document can't say which. Each team names an Onshape team, and the
  user's own membership decides; on both, their choice does.
- **Context from the document, then the choice.** The document someone edits
  says which team the work is for better than anything they would pick. A
  personal document says nothing, so the choice fills the gap. Nobody is put on
  Personal without choosing it.
- **The document's owner is cached in KV.** An insert names its target
  document, and asking Onshape who owns it would cost a call per use. Losing it
  only falls back to the choice.
- **Ranked per active member.** A team of forty would otherwise outrank a team
  of five on size alone.
- **Ranked by percentile, among ten or more.** A fixed count would make gold
  trivial in a quiet feature and unreachable in a busy one. Fewer than ten teams
  would let a team work out who the others are.
- **A team's year runs September to August.** FRC's season is January to April,
  but its teams design all autumn; one window serves both programs.
- **Members-only, not on the public dashboard.** The dashboard reports only
  aggregates. A team's own numbers are about a handful of people, so only they
  see them.
- **Team rollups beside the global ones.** Keying every rollup by team would
  multiply rows for every reader that doesn't care. Two narrow tables hold what
  the team page reads.
- **Team favorites and recents in tables of their own.** A user's rows are keyed
  and trimmed by user; the team's are keyed and trimmed by team, and each list
  stays one indexed query.
- **A weekly FIRST refresh into D1.** Registration searches the list as someone
  types, and FIRST's API is rate limited and changes only as teams register.
- **One Color control.** Parts spell a color as channels or text, and a person
  picking one shouldn't need to know which. Named-option lists are left alone,
  since they can't take an arbitrary color.

_Last reviewed: 2026-11-18_
