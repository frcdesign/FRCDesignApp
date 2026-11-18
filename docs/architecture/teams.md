# Teams

**Status: proposed.** Nothing here is built. The open questions below decide
parts of the design; each answer may change a section.

## Open questions

1. **One team per organization?** The design lets a team have several
   organizations (an enterprise and a classroom), each naming exactly one
   team. A school whose one enterprise holds an FRC and an FTC team would have
   to pick one. Allow an organization several teams, one per program?
2. **Where personal work goes.** A use in a personal document, or from the
   standalone app, counts toward the team the user has switched to. A user can
   switch to **Personal** to count it toward no team. Is that the intent of
   "non-team usage should count as well"?
3. **Who may register.** The design trusts the first verified member of an
   organization to register it, and makes them its team admin. Onshape may
   say who administers a company (`GET /companies`), which is _unverified_.
   Require a company admin instead, once that is checked?
4. **Who sees a team's numbers.** The design makes the team leaderboard and
   each team's page public, like the rest of the dashboard, showing counts
   and medals, never members. A team of one would then show one person's
   use. Hide a team's page from all but its members, and keep only the
   leaderboard public?
5. **Medal thresholds.** Proposed: among teams with any use of a feature in
   the season, the top 10% get gold, the next 15% silver, the next 25% bronze.
   Ranked by uses, or by uses per active member?
6. **Team colors in color parameters.** No part in the libraries shows a color
   dropdown today. The design offers team colors on parts that spell a color
   out as R, G and B (`ParameterRole.COLOR_CHANNEL`) or as text, and on a
   FeatureScript's color input. Which parts or features should get them
   first?
7. **The FIRST team lists need API keys.** FIRST's FRC and FTC Events APIs
   each need a free registered username and token, saved as secrets.

## Purpose

A **team** is a FIRST robotics team, FRC or FTC, as FIRST lists it. A team
registers by linking one or more Onshape **organizations** to itself: an
enterprise, or an educator plan's classroom. Everyone who edits that
organization's documents through the app becomes a member.

A team gets:

- **Context without asking.** Work in a document an organization owns is
  credited to that organization's team. Work anywhere else goes to the team
  the user has switched to.
- **Usage credited to the team** as well as the user, and a team dashboard that
  ranks the team in each of the app's features, with gold, silver and bronze
  medals for the season.
- **Team settings**, set by its team admins:
    - team favorites, marked with a team icon, and whether members may edit
      them;
    - an order of preferred vendors;
    - one or more team colors, offered wherever a color is picked.
- **Shared recents**: what any teammate inserted in the team's context.

It is not:

- **Library editing.** A library's admin team (see [auth.md](./auth.md)) is an
  Onshape team that decides who edits a library. It is unrelated to a FIRST
  team, and nothing here grants a library access level.
- **An account system.** Membership comes from Onshape organizations, and
  identity from Onshape sign-in, as everywhere else in the app.
- **A roster.** The app knows a member only by Onshape user id. It shows no
  names and lists no members to anyone but the team's admins.

"Team" in this document and its code means a FIRST team. The library's admin
team keeps its name in `features/admin-team/`.

## Code map

Proposed, with paths under `src/`. The backend feature is `backend/features/teams/`; the frontend's
is `frontend/features/teams/`.

`backend/features/teams/contract.ts`, a leaf module the frontend also
imports

```ts
/** A FIRST program, reused from `analytics/seasons.ts`. */
type Program = import("../analytics/seasons").Program;

/** `frc-254`, `ftc-16457`: the program and number, which FIRST never reuses within a program. */
type TeamId = `${Lowercase<Program>}-${number}`;

/** A team's role for one of its members. */
enum TeamRole {
    ADMIN = "admin",
    MEMBER = "member"
}

/** Which kind of Onshape company an organization is; see ONSHAPE.md. */
enum OrganizationKind {
    ENTERPRISE = "enterprise",
    CLASSROOM = "classroom"
}

/** The team a use is credited to, and why. */
enum TeamContextSource {
    /** The document's organization belongs to the team. */
    DOCUMENT = "document",
    /** The user switched to it, for a personal document or the standalone app. */
    CHOSEN = "chosen"
}

interface TeamSummary {
    id: TeamId;
    program: Program;
    number: number;
    /** FIRST's nickname for the team. */
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
}

/** One of the caller's teams, as `/api/teams/mine` returns it. */
interface MyTeam extends TeamSummary {
    role: TeamRole;
    settings: TeamSettings;
}

/** What `/api/access-data` adds: the caller's teams and the one chosen. */
interface TeamAccessData {
    teams: MyTeam[];
    /** Undefined for Personal. */
    chosenTeamId?: TeamId;
}

const MAX_TEAM_COLORS = 6;
const MAX_TEAM_FAVORITES = 250;
const MAX_TEAM_RECENTS = 100;
```

`backend/features/teams/first-teams.ts`, the scheduled refresh

```ts
// Every team FIRST lists for the current season, FRC and FTC, upserted.
async function refreshFirstTeams(env: AppBindings): Promise<void>;
```

`backend/features/teams/membership.ts`

```ts
// At `/init`, from the document `findAccessProblem` already read.
async function recordDocumentOwner(
    c: AppContext,
    document: OnshapeDocumentInfo
): Promise<void>;
// The caller's teams, from KV and refilled from D1.
async function getMyTeams(c: AppContext): Promise<MyTeam[]>;
```

`backend/features/teams/context.ts`

```ts
// The team a use in this document is credited to, or undefined for none.
async function resolveTeamContext(
    c: AppContext,
    documentId: string | undefined
): Promise<{ teamId: TeamId; source: TeamContextSource } | undefined>;
```

`src/backend/features/auth/guards.ts`

```ts
// Passes a team admin of the team the path names (`teamRoute()`), and the owner.
const requireTeamAdminMiddleware: MiddlewareHandler<AppEnv>;
// Passes a member of that team.
const requireTeamMemberMiddleware: MiddlewareHandler<AppEnv>;
```

`backend/features/teams/routes.ts`

```text
GET    /api/teams/search?q=                              TeamSummary[], FIRST's list
GET    /api/teams/mine                                   MyTeam[]
POST   /api/teams/register                               { organizationId, teamId }
PUT    /api/teams/chosen                                 { teamId?: TeamId }
GET    /api/teams/:teamId/members                        admin: { userId, role, lastSeenAt }[]
PUT    /api/teams/:teamId/members/:userId                admin: { role }
DELETE /api/teams/:teamId/members/:userId                admin, or the member leaving
PUT    /api/teams/:teamId/settings                       admin: Partial<TeamSettings>
GET    /api/teams/:teamId/favorites/library/:libraryId   member
POST   /api/teams/:teamId/favorites/library/:libraryId   admin, or member when allowed
DELETE /api/teams/:teamId/favorites/:favoriteId          admin, or member when allowed
POST   /api/teams/:teamId/favorites/reorder              admin, or member when allowed
GET    /api/teams/:teamId/recents/library/:libraryId     member
```

`backend/features/analytics/team-queries.ts`, behind the public team
dashboard

```text
GET /api/analytics/teams/leaderboard?season=&feature=    TeamStanding[]
GET /api/analytics/teams/:teamId?season=                 TeamReportOut
```

```ts
enum Medal {
    GOLD = "gold",
    SILVER = "silver",
    BRONZE = "bronze"
}

/** One team's place in one feature over one season. */
interface TeamStanding {
    team: TeamSummary;
    feature: AppFeature;
    uses: number;
    /** 1 for the most uses; teams tied share a rank. */
    rank: number;
    /** Of the teams with any use of the feature that season. */
    rankedTeams: number;
    /** Undefined below bronze. */
    medal?: Medal;
}

interface TeamReportOut {
    team: TeamSummary;
    season: Season;
    /** Every `AppFeature`, at zero uses if unused. */
    standings: TeamStanding[];
    totals: { uses: number; activeMembers: number };
}
```

## Storage

**D1**, in `features/teams/schema.ts`, listed in `drizzle.config.ts`:

- `first_teams` — FIRST's list: `program`, `number`, `name`, `city`,
  `state_province`, `country`, `rookie_year`, `last_season` (the latest season
  FIRST listed it in). Primary key on program and number. Replaced row by row
  by the refresh; a team FIRST stops listing keeps its row.
- `teams` — a registered team: `id` (`TeamId`, referencing `first_teams`),
  `members_edit_favorites`, `vendor_ranking` (JSON), `colors` (JSON),
  `registered_at`, `registered_by`.
- `team_organizations` — `company_id` (primary key: an organization names one
  team), `team_id`, `kind` (`OrganizationKind`), `name` (as Onshape gave it),
  `registered_at`, `registered_by`.
- `team_members` — `team_id`, `user_id`, `role` (`TeamRole`), `joined_at`,
  `last_seen_at`. Primary key on team and user.
- `team_favorites` — the shape of `favorites`, with `team_id` for `user_id`
  and `created_by` beside it. Unique on team, library and insertable; cascade
  on the insertable's delete.
- `team_recent_inserts` — the shape of `recent_inserts`, with `team_id` for
  `user_id` and `user_id` kept as who inserted it. Unique on team, insertable
  and selection; at most `MAX_TEAM_RECENTS` rows per team and library.

**D1**, in `features/analytics/schema.ts`:

- `events.team_id` — the team the event is credited to, or null for none.
  `EVENT_SCHEMA_VERSION` goes to 5; rows before it are null.
- `daily_team_feature_metrics` — keyed by team, feature, season and day: the
  count of the team's uses of the feature, as `featuresOf` decides.
- `daily_team_feature_users` — keyed by team, feature, day and user: who used
  it, for a team's active members.

**KV**, each a `kvStore`:

- `document-owner:` — by document id, the company that owns it, or `cad` for a
  person. Written at `/init` from the document it already read. 30 days.
- `my-teams:` — by user id, the caller's `MyTeam[]`. Rewritten by every
  membership or settings write that touches them; one hour.
- `chosen-team:` — by user id, the team switched to. Kept until changed; losing
  it switches the user to Personal.

**Secrets**: `FIRST_FRC_API_USERNAME`, `FIRST_FRC_API_TOKEN`,
`FIRST_FTC_API_USERNAME`, `FIRST_FTC_API_TOKEN`, listed in
[auth.md](./auth.md)'s environment variables.

**Cron trigger**: weekly, for `refreshFirstTeams`, in `wrangler.jsonc` per
environment.

## Flows

### Refreshing FIRST's team list

1. The weekly cron calls `refreshFirstTeams` through the Worker's `scheduled`
   handler.
2. For each program it pages FIRST's Events API team list for the current
   season (`/v3.0/{season}/teams` for FRC, `/v2.0/{season}/teams` for FTC),
   with basic auth from the secrets.
3. Each page is upserted into `first_teams` in one D1 batch.
4. A program whose secrets are unset is skipped and logged. A failed page is
   retried with the platform's backoff, and the refresh stops at the first page
   that still fails; what it wrote stays.

### Becoming a member

1. Onshape launches the app at `/init`. `findAccessProblem` already reads the
   document (`getDocument`), its `owner` and `permissionSet`.
2. `recordDocumentOwner` saves the owner's company under `document-owner:`.
3. When the owner is a company and the grant has `WRITE`, the caller has shown
   they edit that organization's documents. If the organization is registered,
   the caller is upserted into `team_members` as a member, and `last_seen_at`
   moves to now.
4. Nothing else makes a member: no Onshape call checks membership, and nobody
   is added by hand.

### Registering a team

1. A signed-in user launched from an organization's document that no team
   holds sees **Register your team** in the settings menu.
2. They pick the team from FIRST's list (`/api/teams/search`), by number or
   name.
3. `POST /api/teams/register` takes the launch's organization and the team. It
   refuses an organization the caller has no `document-owner:` evidence of
   editing, and one already registered.
4. It writes the `teams` row if the team has none, the `team_organizations`
   row, and the caller as the team's admin, in one batch.
5. An organization joining a team that already exists makes the caller a
   member, not an admin. The team's admins see it under **Organizations**, and
   can remove it.

### Team context

1. A request that records a use, or writes a recent, names its target
   document. `resolveTeamContext` looks the document up in `document-owner:`.
2. A company that belongs to a team the caller is a member of gives that team,
   `TeamContextSource.DOCUMENT`.
3. Otherwise, a personal document, an unregistered organization, a document
   with no evidence, or no document at all (a STEP download) gives the team in
   `chosen-team:`, `TeamContextSource.CHOSEN`, while the caller is still its
   member.
4. Otherwise there is no team, and the use counts as the user's alone.

### Switching teams

The navbar's settings menu lists the caller's teams and **Personal**.
Picking one writes `chosen-team:` (`PUT /api/teams/chosen`). While the open
document belongs to a team, the menu shows that team as current and says the
document decides; the choice applies again once the user is in a personal
document. A user on one team starts switched to it.

### Usage and the team dashboard

1. `trackInsert`, `trackDownload` and the other trackers take the resolved
   team and write it to `events.team_id`.
2. `rollupWrites` adds the event to `daily_team_feature_metrics` and
   `daily_team_feature_users` for each feature `featuresOf` gives, when it has
   a team. Every other rollup is written as now, so global totals still count
   personal and team use alike.
3. `/dashboard/teams` is the leaderboard: one table per `AppFeature`, the
   season's teams by uses, with their medal.
4. `/dashboard/teams/:teamId` is one team: its medals and rank in every
   feature, its uses, and its active members as a count.
5. A medal is decided per feature and season from the rollups at read time.
   Of the teams with any use, ranked by uses, the top 10% are gold, the next
   15% silver and the next 25% bronze. A team's rank and medal are its own;
   ties share both.

### Team favorites

1. A team favorite is a library's part and its saved selection, like a
   favorite, owned by the team.
2. The Favorites tab lists the current team's favorites first, each with the
   team icon, then the user's own.
3. An admin adds, orders and removes them from a part's menu (**Add to team
   favorites**). A member may too when `members_edit_favorites` is on.
4. A part in both lists shows once, as the team's.

### Shared recents

1. An insert with a team context writes `team_recent_inserts` beside the
   user's own `recent_inserts`, in the same batch.
2. **Recently Used** has two views, **Mine** and **Team**, while the user is
   on a team. Team shows what any teammate inserted in that team's context,
   newest first.

### Vendor ranking

The current team's `vendor_ranking`:

- orders the vendor filter menu, ranked vendors first;
- breaks ties in search results between equally matched parts, the higher
  ranked vendor first;
- picks the screw vendor Auto Assembly opens with, the highest ranked one the
  set makes.

It never hides a part: the filters stay the user's own.

### Team colors

A part whose color is three channel parameters, or one text parameter, shows
the current team's colors as swatches above them. Picking one fills the
channels, or the text, with that color. A FeatureScript's color input offers
them the same way. They are suggestions: any color can still be typed.

## User-facing strings

[docs/strings/teams.md](../strings/teams.md), proposed.

## Invariants

- An organization belongs to at most one team (open question 1).
- Membership is only ever written by `/init`, from a document the caller's
  grant can write and a registered organization owns, or by a team admin
  changing a role or removing a member.
- A team always has at least one admin: the last admin can't leave or be made
  a member.
- A use is credited to a team only while the user is its member.
- `resolveTeamContext` is the one place that decides a use's team.
- Team context never changes what a request does, only where it is counted.
  Resolving it never fails or slows a request: a failure gives no team.
- No team route calls Onshape. Context comes from what `/init` already read.
- Team favorites and team recents are read only by the team's members, and
  written only as the team's settings allow.
- A team's public numbers never name or count one member apart from the rest.
- Every global rollup counts a use the same with a team or without; team
  rollups are additional.
- Every team rollup is derivable from `events` alone.
- Vendor ranking orders results; it never filters them.

## Failure and recovery

| Failure                                              | Result                                                   | Recovery                                    |
| ---------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| FIRST's API refuses or is down                       | The week's refresh stops; last week's list stays         | The next week's run                         |
| A team is new this season and not yet listed         | It can't be registered                                   | The next refresh, or the owner adds its row |
| `document-owner:` expired for a document             | Uses there go to the chosen team                         | The next launch from that document          |
| Someone registers an organization for the wrong team | Its members are credited to that team                    | The owner moves the organization            |
| A member leaves the organization in Onshape          | They stay a member, and their uses in its documents stop | An admin removes them                       |
| `my-teams:` lags a write                             | The menu shows the old teams for up to a minute          | Automatic                                   |

## Decisions

- **Membership from launches, not Onshape's member lists.** `/init` already
  reads the document's owner and the caller's permissions, so a member is
  proven by editing the organization's work at no extra Onshape call. Listing
  a company's members needs a company admin's session and would spend the
  allocation on every sync.
- **Context from the document, then the choice.** The document someone is
  editing says which team the work is for better than anything they would pick.
  A personal document says nothing, so the user's choice fills the gap.
- **The document's owner is cached in KV.** An insert names its target document,
  and asking Onshape who owns it on every insert would cost a call per use.
  Losing the cache only falls back to the chosen team.
- **Teams keyed by program and number.** FIRST numbers are what teams call
  themselves and what the lists key on; an FRC and an FTC team may share a
  number, so the program is part of the key.
- **A weekly FIRST refresh into D1.** Registration searches the list on every
  keystroke; FIRST's API is rate limited and changes only as teams register
  for a season.
- **Medals by rank among active teams.** A fixed count would make gold
  trivial in a quiet feature and unreachable in a busy one. A percentile of the
  teams that used the feature at all keeps each medal meaningful in each.
- **Team rollups beside the global ones.** Folding the team into every rollup's
  key would multiply rows for every reader that doesn't care. Two narrow tables
  hold what the team dashboard reads.
- **Team recents in their own table.** A user's recent row is keyed by user;
  one per team keeps the shared list one indexed query, trimmed per team, and
  leaves the user's own list as it is.

_Last reviewed: 2026-11-18_
