# Favorites migration

One-shot tooling that moved the favorites off the legacy Datastore export and
into D1. Kept because the export is still the only record of what those rows
were, and because the run left decisions in it worth being able to re-read.

```sh
python3 scripts/migrate-favorites/extract.py db-export out/favorites.json
npx tsx scripts/migrate-favorites/build-sql.ts \
    --favorites out/favorites.json --env production --out out/favorites.sql
npx wrangler d1 execute DB --env production --remote --file=out/favorites.sql
```

Two steps in two languages because only Python can read the export's LevelDB
framing, and only TypeScript can canonicalize a selection the way the app does
— `build-sql.ts` calls the real `toSelection`, so the migration cannot drift
from the write path it is imitating. `datastore.py` is a hand-rolled reader for
the export format; nothing else in the repo needs it.

`build-sql.ts` reads the target database rather than taking a dump, because two
of the three things a legacy favorite needs are only knowable there: the
insertable uuid behind an Onshape element id, and the parameters a stored
configuration has to be made canonical against.

## What the mapping is not

A legacy favorite is a key path plus a configuration, and none of the three
parts copies across as-is:

- **Its element id is not an insertable id.** D1 keys insertables by a generated
  uuid and keeps the Onshape element id beside it, so every favorite needs a
  lookup — scoped by library, since documents shared between libraries put one
  element id behind two insertables.
- **Its user may not exist.** `favorites.user_id` is a foreign key, and on the
  production run only 27 of 4,212 owners had ever signed in to the new app. The
  migration writes the missing rows itself, the same `id` + `library_id` pair
  the add-favorite route writes, with the library taken from the user's legacy
  settings where they had any.
- **Its configuration is raw.** Legacy stored display spellings — `0.5 in`,
  `13.75 mm` — and only the values someone overrode. `toSelection` puts them in
  base units and fills in every parameter the element declares. A raw copy would
  key differently and resolve to the wrong thumbnail and part number.

A legacy `null` configuration stays `NULL`: that is the app's spelling for "opens
on the element's own defaults". `created_at` is `NULL` throughout, which the
column allows for exactly this reason — the export carries no timestamp, and
backfilling one would draw a cliff of favorites on a day nobody favorited
anything.

Row ids are derived from `(user, library, insertable)` rather than random, so a
re-run writes the same ids and `INSERT OR IGNORE` makes the whole thing
repeatable.

## The production run

21,831 legacy favorites in, 21,201 written, 4,185 user rows created.

The 630 skipped are all favorites of elements the target has no insertable for:

- 563 in `frc-design-lib`, of elements already gone from the legacy export
  itself — favorites of parts deleted long before the migration.
- 67 in `mkcad`, of live parts (Kraken X60, roboRIO, Robot Battery) that sit in
  `frc-design-lib` in the new app. Legacy `mkcad` carried its own copies of the
  shared Control System, KrayonCAD, Motors & Servos and Sensors documents; the
  new app deliberately does not, so these are dropped on purpose.

Two rows landed on a sort order a live user had just taken — see the note in
`build-sql.ts` — and were moved to the end of that user's list afterwards.
