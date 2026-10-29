# Search

## Purpose

Finds parts in a library by name, group or part number, including the part
number of any indexed configuration, and opens a hit on the configuration it
matched. The index is built on the server and searched entirely in the
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

**R2** `search-index/v3/{libraryId}.json` — the serialized MiniSearch index. The
`v3` names the index's shape: a deploy that changes it bumps the version, and the
route builds the new shape on its first miss.

**D1** `libraries.cache_version` — the `?v=` of every request for the index; see
[loading.md](./loading.md).

## Flows

### Building

1. Every load that wrote, and every reindex of one element, calls
   `rebuildSearchDb` **before** bumping the library version.
2. It reads the library and each insertable's search records, and builds one
   document per insertable: its name, group name, vendors, visibility, and the
   space-joined part numbers of its records. The records
   themselves are stored, not indexed, so a hit can say which configuration it
   matched.
3. The index is written to R2 uncompressed; the runtime compresses responses.

### Serving

`GET /api/search-db/library/:libraryId?v={cacheVersion}` streams the stored index,
cacheable for a year, since the version in the url changes whenever the index
does. A missing index (a new shape after a deploy) is built on the spot.

### How text becomes terms

`tokenize` reads each field into lowercase terms, keeping where each came from
so what matched is what gets underlined. Names and part numbers are read
differently: a name describes the part, a part number identifies it.

| Field            | Text                         | Terms                                               |
| ---------------- | ---------------------------- | --------------------------------------------------- |
| name, group name | `1/2" Hex Shaft (MAXSpline)` | `0.5`, `hex`, `shaft`, `maxspline`, `max`, `spline` |
| part numbers     | `WCP-0016 am-3749`           | `wcp-0016`, `wcp`, `0016`, `am-3749`, `am`, `3749`  |

In a name, sizes become their decimal value (`1/2` and `.5` both read `0.5`; a
mixed number like `1-1/2` reads `1.5`), leading zeros drop, and camelCase splits.
A part number is kept whole and also split at `-` and `/`, spelled as written.

### How a query is read

The query is split at spaces into **words**, and each word into its
**readings**: how a name would read it, plus, for a word with a letter in it,
how a part number would. From `queryWords`:

| Query              | Words and their readings                            |
| ------------------ | --------------------------------------------------- |
| `1/2 hex shaft`    | [`0.5`, `1/2`] · [`hex`] · [`shaft`]                |
| `WCP-0016`         | [`wcp`, `16`, `wcp-0016`, `0016`]                   |
| `am-3749 .196`     | [`am`, `3749`, `am-3749`] · [`0.2`, `0.19`, `.196`] |
| `rev spacer 1-1/2` | [`rev`] · [`spacer`] · [`1.5`, `1-1/2`]             |

A result must match **every word** (AND), and a word matches if **any** of its
readings does (OR), in any field. So `1/2 hex shaft` finds a part only if some
field has `0.5` or `1/2`, some field has `hex`, and some field has `shaft`;
`1/2 hex` alone finds more parts than `1/2 hex shaft`, never fewer. Each reading
matches by prefix, so `spa` finds `spacer` and `374` finds `3749`.

### How results are scored

MiniSearch scores each matching term with BM25 (a term rare in the library and
frequent in the field scores higher, and short fields beat long ones), then:

- **Field weight**: the title and part numbers count fully, the group name at
  0.5. `hex` in a part's own name outranks `hex` in the name
  of the group it sits in.
- **Prefix matches** count for less than whole ones, so a query `16` ranks a
  part numbered `am-16` above one numbered `am-160`.
- A result's score is the sum over the words it matched, so a part matching a
  word in two fields ranks above one matching it in one.

Results come back highest score first, capped at a list's worth.

### Filters and the matched configuration

1. Filters apply during the search: hidden parts (unless showing them), the
   favorites tab, the group being browsed, and vendors. Hits a group or vendor
   filter removed are counted, so the UI can say how many it hid.
2. For each hit, `matchedRecord` picks the configuration record whose part
   number the query matched, preferring a whole term to a prefix: `16` names
   `am-16` but only starts `am-160`. A hit that matched no part number opens on
   the default. The row shows that record's name and part number, and its
   thumbnail.

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
- **Part names are shown, not searched.** A configuration's name mostly repeats
  its insertable's title with a size, so the title already finds the part, and
  indexing every configuration's name made each search slower for it.

_Last reviewed: 2026-09-27_
