# Recents

## Purpose

A signed-in user sees the configurations they last inserted from a library,
most recent first, each opening on that configuration. Two configurations of
one part are two rows. Recents are
per user and per library, and recorded only by inserting: opening the insert
menu without inserting records nothing.

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
| `src/frontend/features/search/search.ts`                    | `doSearch`, narrowed to the recent parts by `insertableIds`    |

## Storage

**D1** `recent_inserts`: `id`, `user_id`, `library_id`, `insertable_id`
(cascade on delete), `selection` (a stored selection, or null for a part with
nothing to configure), `configuration`, `inserted_at`. `configuration` is
`canonicalText` of the selection (empty for a part with nothing to configure),
and is unique with user and insertable, so a configuration has one row however
often, and however it is typed, it is inserted. Indexed on user, library and
time for the list.
At most `MAX_RECENTS` (100) rows per user and library.

**Browser** `uiState.isRecentsOpen`: whether the section is open; it starts open.

## Flows

### Recording

1. `POST /api/add-to-part-studio` and `POST /api/add-to-assembly` call
   `recordRecentInsert` once Onshape has added the part. In an assembly that is
   before any fasten, since a failed fasten leaves the part inserted.
2. `writeRecentInsert` upserts the row for that configuration
   (`toConfiguration`) with the selection as typed this time (`toRowSelection`:
   whole, derivation variables removed) and the time, then deletes the user's
   rows in that library past the newest `MAX_RECENTS`. Both are one D1 batch.
3. The write is awaited, so it lands before the response, but its failure is
   logged rather than thrown: the part is already in the user's document.
4. The insert mutation invalidates the recents query when it settles, so the
   list refetches with the new row at the top.

### Reading

`GET /api/recents/library/:libraryId` returns the caller's recents, newest
first. Like a favorite, each stored selection is made whole against the
insertable's current parameters, and its configuration key and record are
derived per response (`resolveStoredSelection`). The configuration is measured
again against the current parameters, and a row naming one already listed is
left out, since a reload that drops a parameter can make two rows the same.

The frontend shows the section only while signed in, like Favorites. Rows are
resolved against the library's insertables, so a part the user may not see
drops out, and narrowed by the vendor filters like the favorites list.

### Searching

While a search is typed, the section stays, narrowed to the rows whose part
the query matches, between Favorites and the search results. It searches as
the favorites list does: `doSearch` over the parts the rows name
(`insertableIds`), on the part's own name and group only
(`searchConfigurations: false`), since another configuration's part number must
not pull up a row. Every row of a matching part is kept, still newest first
rather than ranked, and the matched words in its title are underlined. The
vendor filters then apply per row.

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
- A user has at most one row per configuration of a part, compared canonically
  (`canonicalText`), never by configuration key.
- What is stored is a selection, never a key; the key and record are derived per
  response.
- A stored selection never holds a derivation variable.
- Deleting an insertable deletes its recents; hiding one deletes them too, as it
  does favorites.
- Recording a recent never fails an insert.

## Failure and recovery

| Failure                                   | Result                                  | Recovery                     |
| ----------------------------------------- | --------------------------------------- | ---------------------------- |
| The recent write fails                    | The insert succeeds; the list misses it | The next insert of that part |
| A reload makes two rows one configuration | One row shown; the other stays stored   | Pushed out by later inserts  |
| The insertable gains a parameter          | Stored selection lacks it               | Defaulted on read            |
| The insertable loses the stored option    | `toSelection` falls back to the default | Insert it again              |

## Decisions

- **Written by the insert route.** The server already knows the insert
  succeeded and the whole selection it applied, so the client sends nothing
  extra and cannot record an insert that did not happen.
- **Awaited, unlike tracking.** Tracking runs after the response; a recent
  written that late could miss the refetch the client makes on settle.
- **One row per configuration.** A part used in two sizes is two things to
  reach for, so each configuration keeps its own row; inserting one again
  moves it up. Configurations are told apart by `canonicalText`, the canonical
  values, so `5 in` and `(2 + 3) in` are one row. A key is for naming a
  thumbnail and is never compared.
- **Recency order while searching.** The list's point is what was used last,
  so a search narrows it without reranking it.
- **Not derived from the analytics log.** Analytics never returns anything about
  one user, and its log is append-only and unbounded; a small table of its own
  keeps the read one indexed query.

_Last reviewed: 2026-10-31_
