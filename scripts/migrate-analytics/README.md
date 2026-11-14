# Analytics migration

One-shot tooling that moved the legacy app's usage log out of GCP and into the
D1 analytics tables. Kept because the run left decisions in it worth being
able to re-read, and so the import can be rebuilt from the archive. [analytics.md](../../docs/architecture/analytics.md)
describes the imported rows under **Imported history**.

```sh
mkdir -p out/gcp-log-bucket
for m in 2025-11 2025-12 2026-01 2026-02 2026-03 2026-04 2026-05 2026-06 2026-07 2026-08 2026-09; do
    npx wrangler r2 object get --remote --file=out/gcp-log-bucket/$m.jsonl.gz \
        frc-design-app-archive/gcp-frc-design-lib-2026-11-14/gcp-log-bucket/$m.jsonl.gz
done
python3 scripts/migrate-analytics/export.py --archive out/gcp-log-bucket out/legacy-events.jsonl
npx tsx scripts/migrate-analytics/build-sql.ts \
    --events out/legacy-events.jsonl --env production --out out/analytics
for f in out/analytics/*.sql; do
    npx wrangler d1 execute DB --env production --remote --yes --file="$f" || break
done
```

The export holds every user's Onshape id: keep it out of the repository.

## The archive

GCP is not needed again. The private R2 bucket `frc-design-app-archive` holds,
under `gcp-frc-design-lib-2026-11-14/`, the raw data alone: every entry of the
log bucket by month, whole, and the legacy Firestore database without its
sessions. Its `README.md` lists the files, their row counts and checksums.

`export.py --archive` reads the monthly files in place of BigQuery and writes
the same rows the query does: on this archive, the same 2,222,481 rows field
for field. Without `--archive` it queries BigQuery, which needs a
`GCP_ACCESS_TOKEN` and the project.

## Where the data was

The Cloud Run app wrote two structured log entries through
`google-cloud-logging`, each tagged `source: frc-design-app-data` so a sink
could route them to their own log bucket:

- **"App opened"** — `userId`, on every launch at `/`.
- **"Part inserted"** — `userId`, `elementId`, `name`, `library`,
  `version.id`, `targetElementType`, `quickInsert`, `isFavorite`, `fasten`,
  `supportsFasten`, and `configuration`: every parameter as
  `{ id, name, type, value }`, an enum's value being its option's _name_.

BigQuery links that bucket as the dataset
`frc-design-lib.frc_design_app_data`, whose `_AllLogs` view is what
`export.py` reads. The bucket starts on 2025-11-14; nothing earlier survives.
The `analytics` dataset beside it holds summary tables built from the same
view. Cloud Monitoring was not read: the log has every event, and a metric
there could hold only counts.

## What the mapping is not

A legacy row is close to a `LoggedEvent`, but five things don't copy across:

- **There is no source.** The legacy app never recorded where an insert
  started, so every imported use is `UseSource.UNKNOWN`, which the dashboard
  shows as "Not recorded" rather than spreading over the real sources.
- **An enum value is a name.** `build-sql.ts` matches it back to an option id
  against the part's parameters as they are now, then runs the selection
  through `canonicalValues` as `trackInsert` does. An option since renamed or
  removed is left out of that use's selection; the use still counts.
- **The first weeks name no library.** An element held by exactly one library
  says which; the rest are `frc-design-lib`, the only library then.
- **There is no document id.** It and the insertable id come from the part as
  it is now, and are null for a part since removed; the element id and the
  version inserted from are the row's own.
- **Some element ids are gone.** Tabs re-created since the log was written,
  among them the most used parts, have new element ids. An element the library
  no longer holds is credited to the one part in that library with a name it was
  inserted under (any of them, case-insensitively), taking that part's element,
  document and parameters, and no version, since the logged one was the old
  tab's. With no such part, or several, it keeps its own id.
  A re-created tab can also give a parameter a new id, so a logged value whose
  id the part doesn't declare is placed by the parameter's name, when exactly
  one parameter has it and the configuration logged it once; conditional
  parameters can share a name.

Nothing is cut at the switch to the Worker. Both backends served for two weeks
of September 2026 while DNS moved, but each request reached one of them, so the
two logs hold different events and the overlap days add up.

## How the SQL is built

`build-sql.ts` doesn't reimplement the rollups. It runs each converted event
through the real `rollupWrites`, executing the statements in a scratch SQLite
database built from `drizzle/`, so the imported rollups are what the live write
path would have written. It then dumps each scratch database as one SQL file:

- the events, as plain `INSERT`s with ids of `legacy-<insert_id>`, so applying
  a file a second time fails on its first row before anything is counted again;
- every rollup row, as an upsert that merges into the target the way the
  table's `onConflict` in `rollups.ts` does. `MERGES` names the merge for each
  column, and a rollup column it doesn't name stops the build.

A remote `wrangler d1 execute --file` is one import that D1 rolls back whole if
it fails, so each file lands entirely or not at all. Files are runs of whole
days, at most 100,000 events each (`--max-events`), to keep each import short,
since D1 runs one query at a time and the app's queries queue behind it.

The build refuses a target that already holds imported events
(`schema_version` 0, `LEGACY_SCHEMA_VERSION`).

## The build

From the 2,222,481 rows of the export, against production's 2,670
insertables: 24 files, 785 MB, nothing skipped.

- 153,270 inserts credited to a re-created part by name; 56,761 of parts
  since removed, which count in the totals and are listed nowhere.
- Of 3,556,414 logged values, 15,041 placed by parameter name, 39,726 left out
  for a parameter the part no longer declares (most of them a re-created
  spacer's dropped color parameters), and 49,553 for an option it no longer
  offers.

Applied in order to a local copy, the files gave exactly the tables a single
unsplit build did, so each merge reproduces `rollupWrites`; every day's inserts,
opens and distinct users, and every part's uses, matched BigQuery and the
export.

## The production run

Filled in once the files are applied.
