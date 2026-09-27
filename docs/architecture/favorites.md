# Favorites

## Purpose

A signed-in user can favorite insertables in a library, order them, and save the
configuration each one opens with. Favorites are per user and per library.

## Code map

| Path                                                                                | Role                                                        |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/backend/features/favorites/contract.ts`                                        | `Favorite`, `FavoritesData`, `MAX_FAVORITES`                |
| `src/backend/features/favorites/routes.ts`                                          | List, add, delete, reorder, and set the saved configuration |
| `src/frontend/features/favorites/queries.ts`                                        | Query and optimistic mutations                              |
| `src/frontend/features/favorites/components/favorites-list.tsx`                     | The Favorites tab, searchable through the library index     |
| `src/frontend/features/favorites/components/favorite-button.tsx`                    | Toggling a favorite                                         |
| `src/frontend/features/favorites/components/save-favorite-configuration-button.tsx` | Saving the configuration on screen                          |
| `src/frontend/features/insert/components/reset-configuration-items.tsx`             | Reset to default / to the favorite's configuration          |

## Storage

**D1** `favorites`: `id`, `user_id`, `library_id`, `insertable_id` (cascade on
delete), `default_selection` (a stored selection, or null for the defaults),
`sort_order`, `created_at`. Unique on user, library and insertable.

`users` holds one row per user who has favorited anything; a favorite references
it, so adding one inserts the user first.

## Flows

### Reading

`GET /api/favorites/library/:libraryId` returns the caller's favorites in order.
For each it makes the stored selection whole against the insertable's current
parameters (`toSelection`), and **derives** its configuration key and matching
record, rather than storing them: a reload can move the defaults a key is
measured against, and the record must match the saved configuration's part
number.

### Writing

- **Add**: the client picks the favorite's id, so the optimistic entry and the
  server row agree. The selection, if any, is stored with `toStoredSelection`
  (whole, derivation variables removed). Past `MAX_FAVORITES` (250) answers 409.
- **Delete**, **reorder** and **set configuration**: every write is scoped to the
  caller's user id, so another user's favorite id matches nothing. A reorder is
  one D1 batch.
- The frontend applies each change optimistically and refetches on settle.

### Opening a favorite

The insert menu opens on the favorite's saved selection, and its thumbnail row
asks for that configuration's render (see [thumbnails.md](./thumbnails.md)).
**Reset to favorite default** returns to it; **Reset to default** to the
element's own defaults.

## Invariants

- A favorite is only ever read or written by its owner: every query filters by
  the caller's user id.
- What is stored is a selection, never a key; the key and record are derived per
  response.
- A stored selection never holds a derivation variable.
- Deleting an insertable deletes its favorites.

## Failure and recovery

| Failure                               | Result                                  | Recovery                     |
| ------------------------------------- | --------------------------------------- | ---------------------------- |
| The insertable gains a parameter      | Stored selection lacks it               | Defaulted on read            |
| The insertable loses the saved option | `toSelection` falls back to the default | Save the configuration again |
| Signed out                            | No favorites shown; prompt to sign in   | Sign in                      |

## Decisions

- **Client-chosen ids.** The optimistic row and the stored one share an id, so
  a follow-up edit before the refetch hits the right row.
- **Derived keys.** Storing a key would go stale the moment a reload changed the
  element's defaults.

_Last reviewed: 2026-09-27_
