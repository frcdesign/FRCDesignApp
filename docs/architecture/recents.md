# Recents

## Purpose

A signed-in user sees the parts they last inserted from a library, most recent
first, each opening on the configuration it was last inserted with. Recents are
per user and per library, and recorded only by inserting: opening the insert
menu without inserting records nothing.

It is not usage tracking: [analytics.md](./analytics.md) logs every insert for
the dashboard, and never reads back per user. Recents keep one row per part and
are read only by their owner.

## Code map

| Path                                                        | Role                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| `src/backend/features/recents/contract.ts`                  | `RecentInsert`, `RecentsData`, `MAX_RECENTS`                 |
| `src/backend/features/recents/store.ts`                     | `recordRecentInsert`, `writeRecentInsert`: record one insert |
| `src/backend/features/recents/routes.ts`                    | List the caller's recents, and remove one                    |
| `src/backend/features/configurations/stored-selections.ts`  | Reading a stored selection back, with its key and record     |
| `src/backend/features/library/insertables/routes.ts`        | The insert routes, which record each insert                  |
| `src/frontend/features/recents/queries.ts`                  | The query, its prefetch, and removing one                    |
| `src/frontend/features/recents/components/recents-list.tsx` | The **Recently Used** section, under Favorites               |
| `src/frontend/features/recents/components/recent-card.tsx`  | One row and its menu                                         |
| `src/frontend/routes/app/library/$libraryId/index.tsx`      | Where the section is stacked                                 |

## Storage

**D1** `recent_inserts`: `user_id`, `library_id`, `insertable_id` (cascade on
delete), `selection` (a stored selection, or null for a part with nothing to
configure), `inserted_at`. Keyed on user and insertable, so a part has one row
however often it is inserted; indexed on user, library and time for the list.
At most `MAX_RECENTS` (10) rows per user and library.

**Browser** `uiState.isRecentsOpen`: whether the section is open; it starts open.

## Flows

### Recording

1. `POST /api/add-to-part-studio` and `POST /api/add-to-assembly` call
   `recordRecentInsert` once Onshape has added the part. In an assembly that is
   before any fasten, since a failed fasten leaves the part inserted.
2. `writeRecentInsert` upserts the row with the selection (`toRowSelection`:
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
derived per response (`resolveStoredSelection`).

The frontend shows the section only while signed in and not searching. Rows
are resolved against the library's insertables, so a part the user may not see
drops out, and narrowed by the vendor filters like the favorites list.

### Opening and removing

A row opens the insert menu on the stored selection, with
`InsertSource.RECENTS` as its source; its thumbnail asks for that
configuration's render (see [thumbnails.md](./thumbnails.md)). The row's menu
offers quick insert, favoriting with that selection, and **Remove**, which is
`DELETE /api/recents/library/:libraryId/insertable/:insertableId`, applied
optimistically and refetched on settle.

## Invariants

- A recent is only ever read or written by its owner: every query filters by the
  caller's user id.
- A user has at most `MAX_RECENTS` rows per library after any insert.
- What is stored is a selection, never a key; the key and record are derived per
  response.
- A stored selection never holds a derivation variable.
- Deleting an insertable deletes its recents; hiding one deletes them too, as it
  does favorites.
- Recording a recent never fails an insert.

## Failure and recovery

| Failure                                | Result                                  | Recovery                     |
| -------------------------------------- | --------------------------------------- | ---------------------------- |
| The recent write fails                 | The insert succeeds; the list misses it | The next insert of that part |
| The insertable gains a parameter       | Stored selection lacks it               | Defaulted on read            |
| The insertable loses the stored option | `toSelection` falls back to the default | Insert it again              |

## Decisions

- **Written by the insert route.** The server already knows the insert
  succeeded and the whole selection it applied, so the client sends nothing
  extra and cannot record an insert that did not happen.
- **Awaited, unlike tracking.** Tracking runs after the response; a recent
  written that late could miss the refetch the client makes on settle.
- **One row per part.** Inserting a part again moves it up and replaces its
  selection, so ten rows are ten different parts.
- **Not derived from the analytics log.** Analytics never returns anything about
  one user, and its log is append-only and unbounded; a small table of its own
  keeps the read one indexed query.

_Last reviewed: 2026-10-31_
