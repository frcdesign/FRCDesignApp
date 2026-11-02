# Recents

## Purpose

A signed-in user sees the configurations they last inserted from a library,
most recent first, each opening on that configuration. Two configurations of
one part are two rows. Recents are per user and per library, and recorded only
by inserting: opening the insert menu without inserting records nothing.

It is not usage tracking: [analytics.md](./analytics.md) logs every insert for
the dashboard, and never reads back per user. Recents keep one row per
configuration and are read only by their owner.

## Code map

| Path                                                        | Role                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| `src/backend/features/recents/contract.ts`                  | `RecentInsert`, `RecentsData`, `MAX_RECENTS`                   |
| `src/backend/features/recents/store.ts`                     | `recordRecentInsert`, `writeRecentInsert`: record one insert   |
| `src/backend/features/recents/routes.ts`                    | List the caller's recents, and remove one                      |
| `src/backend/features/configurations/stored-selections.ts`  | Reading a stored selection back, with its key and record       |
| `src/backend/features/library/insertables/routes.ts`        | The insert routes, which record each insert                    |
| `src/frontend/features/recents/queries.ts`                  | The query, its prefetch, and removing one                      |
| `src/frontend/features/recents/components/recents-list.tsx` | The **Recently Used** section, under Favorites, and its search |
| `src/frontend/features/recents/components/recent-card.tsx`  | One row and its menu                                           |
| `src/frontend/routes/app/library/$libraryId/index.tsx`      | Where the section is stacked                                   |
| `src/frontend/features/search/list-search.ts`               | `searchList`: the rows searched by their own part numbers      |

## Storage

**D1** `recent_inserts`: `id`, `user_id`, `library_id`, `insertable_id`
(cascade on delete), `selection` (a stored selection, empty for a part with
nothing to configure), `inserted_at`. The same shape as a favorite: only the
selection, collapsed by `toSelection`, with nothing derived from it. Unique on
user, insertable and selection: a collapsed selection has one spelling, so that
is one row per configuration. Indexed on user, library and time for the list. At most `MAX_RECENTS` (100) rows per user
and library.

**Browser** `uiState.sections.recents`: whether the section is open; it starts open.

## Flows

### Recording

1. `POST /api/add-to-part-studio` and `POST /api/add-to-assembly` call
   `recordRecentInsert` once Onshape has added the part. In an assembly that is
   before any fasten, since a failed fasten leaves the part inserted.
2. `writeRecentInsert` upserts the row for the selection
   (`toStoredSelection`), moving an existing one to now, then deletes the
   user's rows in that library past the newest `MAX_RECENTS`. Both are one D1
   batch.
3. The write is awaited, so it lands before the response, but its failure is
   logged rather than thrown: the part is already in the user's document.
4. The insert mutation invalidates the recents query when it settles, so the
   list refetches with the new row at the top.

### Reading

`GET /api/recents/library/:libraryId` returns the caller's recents, newest
first. Like a favorite, each stored selection is made whole against the
insertable's current parameters, and its configuration key and record are
derived per response (`resolveStoredSelection`).

The frontend shows the section only while signed in, like Favorites. Rows are
resolved against the library's insertables, so a part the user may not see
drops out, and narrowed by the vendor filters like the favorites list.

### Searching

While a search is typed, the section stays, between Favorites and the search
results, narrowed to the rows the query matches and ranked as every search
result is. It is searched by `searchList` (see [search.md](./search.md)): each
row by its part's name and group and by its own configuration's part number,
so two sizes of a part are found apart by number. Matched words in the title
and part number are underlined, and the vendor filters then apply per row.

### Opening and removing

A row opens the insert menu on the stored selection, with
`InsertSource.RECENTS` as its source; its thumbnail asks for that
configuration's render (see [thumbnails.md](./thumbnails.md)), and the icon
beside its title lists that configuration on hover (see
[configurations.md](./configurations.md)). The row's menu
offers quick insert, favoriting with that selection, and **Remove**, which is
`DELETE /api/recent/:recentId`, removing that configuration only, applied
optimistically and refetched on settle.

## Invariants

- A recent is only ever read or written by its owner: every query filters by the
  caller's user id.
- A user has at most `MAX_RECENTS` rows per library after any insert.
- A user has one row per stored selection of a part, enforced by D1.
- A row stores only the selection, never a key or anything else derived from
  it; the key and record are derived per response.
- A stored selection never holds a derivation variable.
- Deleting an insertable deletes its recents; hiding one deletes them too, as it
  does favorites.
- Recording a recent never fails an insert.

## Failure and recovery

| Failure                              | Result                                                                                                             | Recovery                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| The recent write fails               | The insert succeeds; the list misses it                                                                            | The next insert of that configuration  |
| A reload changes a part's parameters | A row may name an option that is gone, or two rows may now open on one configuration; accepted, since this is rare | Pushed out by later inserts, or Remove |

## Decisions

- **Written by the insert route.** The server already knows the insert
  succeeded and the whole selection it applied, so the client sends nothing
  extra and cannot record an insert that did not happen.
- **Awaited, unlike tracking.** Tracking runs after the response; a recent
  written that late could miss the refetch the client makes on settle.
- **One row per configuration.** A part used in two sizes is two things to
  reach for, so each configuration keeps its own row; inserting one again
  moves it up.
- **Unique on the selection.** Collapsing gives a configuration one
  spelling, so the stored selection is its own identity and D1 enforces one
  row per configuration in a single upsert. Selections that differ only in a
  parameter a condition hides are two rows; the insert menu settles hidden
  parameters to their defaults, so this does not arise from it.
- **A part's configuration changing is not defended against.** Configurations
  change rarely, and the cost is a row that opens oddly until it is pushed out
  or removed, so the read does no reconciling.
- **Not derived from the analytics log.** Analytics never returns anything about
  one user, and its log is append-only and unbounded; a small table of its own
  keeps the read one indexed query.

_Last reviewed: 2026-11-01_
