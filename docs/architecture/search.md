# Search

## Purpose

Finds parts in a library by name, group, part number or part name, including the
part number of any indexed configuration, and opens a hit on the configuration
it matched. The index is built on the server and searched entirely in the
browser, so typing never waits on the network.

## Code map

| Path                                      | Role                                                               |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `src/backend/features/search/contract.ts` | `SearchDocument` and `SEARCH_OPTIONS`, shared by both sides        |
| `src/backend/features/search/fields.ts`   | The indexed field names                                            |
| `src/backend/features/search/tokenize.ts` | How names and part numbers become terms, with their spans          |
| `src/backend/features/search/records.ts`  | Configuration records to search records, and matching a hit to one |
| `src/backend/features/search/build.ts`    | `buildSearchDb`: one document per insertable                       |
| `src/backend/features/library/db.ts`      | `rebuildSearchDb`, `searchIndexKey`                                |
| `src/backend/features/library/routes.ts`  | `GET /api/search-db/...`                                           |
| `src/frontend/features/search/queries.ts` | Loads the index, keyed by the library's cache version              |
| `src/frontend/features/search/search.ts`  | `doSearch`: the query, filters, ranking and highlighting           |
| `src/frontend/features/search/filter.ts`  | Browsing and searching produce the same list shape                 |

## Storage

**R2** `search-index/v2/{libraryId}.json` — the serialized MiniSearch index. The
`v2` names the index's shape: a deploy that changes it bumps the version, and the
route builds the new shape on its first miss.

**D1** `libraries.cache_version` — the `?v=` of every request for the index; see
[loading.md](./loading.md).

## Flows

### Building

1. Every load that wrote, and every reindex of one element, calls
   `rebuildSearchDb` **before** bumping the library version.
2. It reads the library and each insertable's search records, and builds one
   document per insertable: its name, group name, vendors, visibility, and the
   space-joined part numbers and part names of its records. The records
   themselves are stored, not indexed, so a hit can say which configuration it
   matched.
3. The index is written to R2 uncompressed; the runtime compresses responses.

### Serving

`GET /api/search-db/library/:libraryId?v={cacheVersion}` streams the stored index,
cacheable for a year, since the version in the url changes whenever the index
does. A missing index (a new shape after a deploy) is built on the spot.

### Searching

1. `tokenize` splits text into terms: at separators, at camelCase boundaries, and
   around sizes, with fractions and mixed numbers kept whole (`5/32`,
   `1-1/2`) and numbers in canonical decimal form so `.196`, `.19` and `0.19`
   meet. Each term keeps its span, so what matched is what gets underlined.
2. Each word the user types becomes an OR of its readings, and the words are
   ANDed: every word must match something. Terms match by prefix; a part name
   ranks below the title and the group name below that.
3. Filters apply during the search: visibility, the favorites tab, the group
   being browsed, and vendors. Hits a filter removed are counted, so the UI can
   say how many a filter hid.
4. `matchedRecord` picks the record whose part number or name the query matched,
   preferring a whole term to a prefix, and the row opens on that configuration
   and shows its thumbnail.

## Invariants

- The backend and frontend use the same `SEARCH_OPTIONS` and `tokenize`, so a
  term is spelled the same when indexed and when searched.
- The index is rebuilt before the version bump that publishes it.
- The index's url includes the library version, so no cache ever serves an
  index older than the library it describes; nothing invalidates it otherwise.
- Hidden elements are in the index and filtered at search time, so admins can
  search them.

## Failure and recovery

| Failure                       | Result                        | Recovery                  |
| ----------------------------- | ----------------------------- | ------------------------- |
| The index object is missing   | Built on the next request     | Automatic                 |
| A rebuild fails during a load | The load fails before bumping | The next load rebuilds it |

## Decisions

- **Client-side search.** A library's index is small enough to download once per
  version, and searching locally makes every keystroke instant.
- **Words ANDed, readings ORed.** A word like a size has several readings; any
  will do, but a query of several words should narrow, not widen.
- **Records stored with the index.** A part-number hit opens the configuration
  it names without another request.

_Last reviewed: 2026-09-27_
