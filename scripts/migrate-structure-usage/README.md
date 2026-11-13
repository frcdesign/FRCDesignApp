# Structure usage migration

ConfigLib's Structure document was copied and the original deleted
(2026-11-10). Onshape gave every tab of the copy a new element id, and usage is
keyed by element id, so the old document's 7,548 uses stayed in the log and the
rollups under ids no part has any more. `migrate.sql` moves them to the copies.

```sh
npx wrangler d1 execute DB --env production --remote --file=scripts/migrate-structure-usage/migrate.sql
```

It rewrites the log (`events`) first, then folds each per-part rollup row into
the new id and deletes the old one. Applying it twice changes nothing more.

## How the pairs were found

The old insertables were deleted with their group, so no name survives for an
old element id. A copy keeps each configuration parameter's id, though, and
every logged use carries its selection. An old tab is paired with the new tab
whose parameter ids are exactly the ones its selections name.

- 20 old tabs pair with one new tab each: 7,335 uses. Two of them are S -
  Channel (GB), whose tab was replaced on 2026-11-02.
- 1 old tab (`2d996271…`, 137 uses) has a single parameter that both
  S - Threaded L Bracket (GB) and Angled brackets carry. The owner judged it
  the Threaded L Bracket.
- 7 old tabs (76 uses, six of them last used in September, one in October)
  match no new tab: they were removed before the copy. Their history stays
  under the old ids.

Favorites and recents of the old parts were deleted with them (both cascade
from `insertables`) and are not in the log, so this does not bring them back.
