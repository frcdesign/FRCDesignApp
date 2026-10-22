# Generated parts

## Purpose

Library parts that FeatureScript generates: Part Studios in a library document
whose feature builds the part and sets its properties, and whose configuration
robot-code (`robot-education/robot-code`) writes from the same definition as the
FeatureScript's data. The library's fasteners (screws, washers and nuts) are the
first.

They're ordinary insertables in ordinary groups, so browsing, search, favorites,
thumbnails and the insert menu treat them like any other part. What differs is
where a load gets their configurations' parts: robot-code's generated records,
synced here, rather than asking Onshape about each configuration. So they have
no indexing limit and no admin indexing controls, and the generator is the
source of truth: a tab configured otherwise fails its load.

Parts modeled by hand aren't generated, whatever their configuration.

## Code map

| Path                                                                 | Role                                                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `scripts/sync-generated-parts.js`                                    | `npm run sync:generated-parts`: copies robot-code's manifests in at a pinned commit           |
| `src/backend/features/generated-parts/studios.gen.ts`                | The synced studios: each one's configuration as Onshape answers it, and where it's released   |
| `src/backend/features/generated-parts/records.gen.ts`                | The synced records: each studio's part per configuration                                      |
| `src/backend/features/generated-parts/studios.ts`                    | `GENERATED_STUDIOS` parsed by `parseOnshapeConfiguration`, `findGeneratedStudio`; client-safe |
| `src/backend/features/generated-parts/records.ts`                    | `generatedConfiguration`, `describeMismatch`, `GeneratedPartMismatchError`; the server's      |
| `src/backend/features/load/load-insertable.ts`                       | `probeInsertable`: a generated tab's records come from `generatedConfiguration`               |
| `src/backend/features/load/load-group.ts`                            | Flags a mismatched tab `GENERATED_PART_MISMATCH` beside `LOAD_FAILED`                         |
| `src/frontend/features/library/components/generated-badge.tsx`       | `GeneratedBadge`: the library card's FeatureScript mark                                       |
| `src/frontend/features/build-status/components/indexing-section.tsx` | Says a generated part indexes every configuration, in place of the indexing switches          |

robot-code owns each set's definition: for the fasteners,
`featurescripts/fasteners/fastenerTables.py`, which writes the FeatureScript's
tables, each Part Studio's configuration and the manifest
(`fasteners.gen.json`) from one list of records, one per configuration
the configuration offers (`ConfiguredStudio.combinations()`). Its features set
exactly the properties the records name. An input hidden where only its default
is made (the screw's Fully threaded, the washer's Finish) is left out of a record
there, as `enumerateConfigurations` leaves it unset.

## Storage

**D1** `insertables.generated_studio` — the generated studio a tab is, as
`set/key` (`fasteners/screw`); null for a tab modeled by hand. Written by each
load.

The records themselves are stored as any indexed insertable's are: the
default's in `insertables.part_metadata`, the rest in `configurations.records`.

## Flows

### Syncing

`npm run sync:generated-parts -- <ref> [--from ../robot-code]` reads each set's
manifest at a robot-code commit and writes `studios.gen.ts` and
`records.gen.ts`, one line each (prettier would spread them over tens of
thousands). The fasteners' manifest also writes Quick fastener's own files (see
[quick-fastener.md](./quick-fastener.md)).

### Loading a generated tab

`probeInsertable`, after reading the tab's configuration (one Onshape call):

1. `findGeneratedStudio` matches the tab by document and element against each
   synced studio's location. No match: the load goes on as for any tab.
2. `describeMismatch` checks the tab's parameters against the studio's: the
   same parameters, names, defaults and options, offering exactly the
   configurations there are records for (enumerated with
   `enumerateConfigurations`, so conditions Onshape spells differently but which
   show the same pass).
3. A mismatch throws `GeneratedPartMismatchError`: the tab fails, keeps its last
   good load, and is flagged `GENERATED_PART_MISMATCH` and `LOAD_FAILED`; its
   group keeps its last good version.
4. Otherwise the default configuration's record is its part metadata, every
   other configuration's is a record, and the records' vendors are its vendors.
   No configuration is probed, and `decideIndexing` isn't consulted.

The default parts are still read (for the thumbnail and the composite check), as
is fasten info when it's on.

### Changing a generated part

1. Change the definition in robot-code, which writes the FeatureScript's tables
   from the records; its tests check the records against the configurations
   offered.
2. Release it (`fs release fasteners`): robot-code points the library
   document's Feature Studio at a new backend version, builds each Part Studio
   there from the definition (creating its tab if it's missing, writing its
   configuration, and inserting or updating its feature), versions the library
   document, and records where each studio is (`fastenerTables.studios.json`),
   which the manifest's locations come from. Nothing is made by hand. Commit
   what it wrote.
3. Sync the commit here and deploy.
4. Load the group. A load that runs before the deploy fails the changed tabs
   (step 3 of loading) rather than store parts the generator didn't name, so the
   library shows the last good version until the app has the new records.

### Indicator

`InsertableOut.isGenerated` puts `GeneratedBadge` beside the library card's
title. The build status carries `generatedStudio`, and the indexing section
shows it in place of the indexing switches.

## Invariants

- A generated tab's records are robot-code's, never probed: one per
  configuration its configuration offers.
- A tab whose configuration isn't its studio's fails its load; nothing about it
  is stored from that load.
- A generated part's indexing isn't configurable: the indexing routes refuse it
  (400), and the load ignores its stored settings.
- The generator's records and the FeatureScript's properties are written from
  the same definition, so what the library indexes is what the part says.

## Failure and recovery

| Failure                                         | Result                                                 | Recovery                                                                   |
| ----------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| The tab's configuration isn't the generated one | `GENERATED_PART_MISMATCH`; it keeps its last good load | Release the fasteners again (`fs release`), or sync the generator's commit |
| A studio's location isn't synced yet            | It loads as a hand-modeled tab, probed and capped      | Sync the commit with the release's recorded locations                      |

## Decisions

- **The generator is the source of truth.** A mismatch fails rather than falls
  back to probing: probed parts the generator didn't name would quietly disagree
  with what Quick fastener and the FeatureScript say.
- **In the library's documents, not a library of their own.** Generated parts
  are found, favorited and inserted like any part, so they share all of it;
  only where their records come from differs.
- **Compared by what the configuration shows.** Onshape may store a visibility
  condition in another form than robot-code sent, so the check enumerates the
  configurations offered rather than comparing conditions.
- **Synced, not evaluated.** Onshape's FeatureScript evaluation only sees std,
  so a load can't ask the feature for its table; robot-code writes the records
  beside the tables instead.

_Last reviewed: 2026-10-21_
