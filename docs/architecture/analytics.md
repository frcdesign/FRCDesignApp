# Analytics and the dashboard

## Purpose

Records how the libraries are used — each insert and each launch from Onshape —
and reports it on a public dashboard: totals and trends, per-library health,
which parts and configuration options are used, and which aren't. It exists so
the library team can see what to maintain and what to cut.

It records nothing a user sees back about themselves, and reports only
aggregates.

## Code map

| Path                                                                  | Role                                                              |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/backend/features/analytics/tracking.ts`                          | `trackInsert`, `trackAppOpen`: record an event after the response |
| `src/backend/features/analytics/usage.ts`                             | `EventType`, `InsertSource`, `EVENT_SCHEMA_VERSION`               |
| `src/backend/features/analytics/logged-event.ts`                      | Which columns each kind of event sets                             |
| `src/backend/features/analytics/schema.ts`                            | The event log and every rollup table                              |
| `src/backend/features/analytics/rollups.ts`                           | `rollupWrites`: the rollup rows one event adds to                 |
| `src/backend/features/analytics/day.ts`                               | Day keys in the reporting time zone                               |
| `src/backend/features/analytics/seasons.ts`                           | FRC and FTC seasons, for season-over-season comparison            |
| `src/backend/features/analytics/range.ts`, `growth.ts`                | Date ranges, clamped to when tracking began; growth windows       |
| `src/backend/features/analytics/metric-queries.ts`, `part-queries.ts` | The dashboard's reads over the rollups                            |
| `src/backend/features/analytics/health.ts`                            | Build-issue counts per library                                    |
| `src/backend/features/analytics/parameter-usage.ts`                   | Option usage, per way a parameter is shown                        |
| `src/backend/features/analytics/routes.ts`                            | `GET /api/analytics/...`                                          |
| `src/backend/features/entry/routes.ts`                                | `POST /api/app-open/...`, sent on a launch from Onshape           |
| `src/frontend/routes/dashboard/`                                      | The dashboard pages: overview, library, part, unused              |
| `src/frontend/features/dashboard/`                                    | The dashboard's queries, charts and tables                        |

## Storage

**D1**, in `features/analytics/schema.ts` (kept apart from `db/schema.ts`, since
no foreign key crosses between them):

- `events` — the append-only log. Every event has an id, type, time, day key,
  user and schema version, and the library where it has one; an insert adds the
  element path, insertable, target tab type, canonical selection, source, and
  the favorite, quick-insert and fasten flags, and a version run adds its kind,
  scope and four counts. Keyed on Onshape's element id with no foreign keys, so
  history survives a reload or a re-added tab.
- `library_id` is null for an event that belongs to no library. A version run
  acts on the Onshape document the app was launched from, which need not be in
  any library, so it has none.
- Rollups, each derived from the log alone: `daily_metrics`,
  `daily_target_metrics`, `daily_source_metrics`, `insertable_stats`,
  `daily_insertable_metrics`, `daily_insertable_users`,
  `daily_configuration_metrics`, `daily_user_activity`, `user_stats`,
  `daily_version_metrics`.

## Flows

### Recording

1. An insert route calls `trackInsert` once the insert succeeded; `/init`'s
   handoff calls `POST /api/app-open/...`, which calls `trackAppOpen`; the
   version manager's workflow calls `trackVersionRun` once its run has
   finished, so a run that failed halfway still records what it managed.
2. Both run in the background (`runInBackground`), after the response, so
   tracking never slows or fails what the user asked for.
3. The selection is stored canonically (`canonicalValues`), so `5 in` and
   `(2 + 3) in` count as one value.
4. `record` writes the event and its rollup rows in one D1 batch, so neither
   lands without the other.

### Days and seasons

A day key is the date in `America/New_York`, since US teams work evenings that
UTC midnight would split. Reports end yesterday: today is still filling, and
would dip every chart. Growth compares a season's stretch with the same stretch
of the previous season (`seasons.ts`), since a January–April competition year
is nothing like a calendar year; between seasons it shows the last complete one.

### Reporting

The dashboard is a sibling of `/app`, a full-screen page outside the Onshape
panel. Its routes read only rollups and return only aggregates:

- **Overview** — totals, per-library summaries, insert and metric series, insert
  sources, growth, and the version manager's own totals.
- **Library** — its summary, health (build issues by severity, hidden elements
  left out), and its parts table.
- **Part** — one element's history, and usage of each configuration option,
  split per way the option is shown (`toParameterInstances`).
- **Unused** — parts and options at or below a usage threshold.

The range, threshold and preset live in the url, so a view can be shared.

## Invariants

- Tracking never fails or delays the request it records.
- Analytics routes are public: they never call `getUserId()` or
  `getOnshapeApi()`, and never return anything about one user.
- Every rollup is derivable from `events` alone, so the rollups can be rebuilt by
  replaying the log.
- Every rollup but `daily_version_metrics` is keyed by library, so an event
  without one writes only that.
- An event's columns are decided in `logged-event.ts`; a new column fails to
  compile until each kind of event says what it holds.
- Values are compared and counted canonically, never by configuration key.
- Changing what a column means bumps `EVENT_SCHEMA_VERSION`.

## Failure and recovery

| Failure                               | Result                                                       | Recovery                                                        |
| ------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| The tracking write fails              | That event is lost; the insert is unaffected                 | None needed                                                     |
| A rollup is wrong after a code change | Dashboard numbers off                                        | Replay `events` through `rollupWrites`; no script does this yet |
| A range starts before tracking began  | Clamped; growth withheld when its baseline predates tracking | Automatic                                                       |

## Decisions

- **A version run has no library.** It acts on whatever document Onshape
  launched the app from. Attributing it to the library the person happened to
  have open would say more about their last tab than about anything real, so
  `library_id` is null and the run rolls up into a table of its own.
- **Version runs are not activity.** They write no row to `daily_user_activity`
  or `user_stats`: "active user" has always meant somebody who inserted
  something, and counting runs there would move the line under every historical
  figure.
- **A log plus rollups.** The log keeps everything for replay; rollups keep every
  dashboard read a small indexed query.
- **Keyed by element, not insertable.** An insertable row is replaced when a tab
  is removed and re-added; its element id is not.
- **Public aggregates.** The numbers are useful to the community, and nothing
  per-user is exposed.
- **The module isn't called `events.ts`.** Ad blockers match an `events-<hash>.js`
  chunk, and the frontend imports its enums.

_Last reviewed: 2026-09-27_
