# Generated parts

## Purpose

Library parts that FeatureScript generates. Each is a Part Studio in a library
document, holding one feature that builds the part and sets its properties.
robot-code (`robot-education/robot-code`) writes the Part Studio's
configuration and the feature's data from one definition. The library's
fasteners (screws, washers and nuts) are the first.

They're ordinary insertables in ordinary groups, so browsing, search,
favorites, thumbnails and the insert menu treat them like any other part. Only
the source of their records differs: a load reads them from the manifest
robot-code releases beside the Part Studios, rather than asking Onshape about
each configuration. So they have no indexing limit and no admin indexing
controls.

Parts modeled by hand aren't generated, whatever their configuration.

## Code map

| Path                                                             | Role                                                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/backend/features/generated-parts/manifest.ts`               | The released manifest: `findManifestTabs`, `parseManifest`, `generatedTabs`, `releasedStudio`, `releasedCatalog` |
| `src/backend/features/generated-parts/store.ts`                  | `saveGeneratedSet`, `getGeneratedSet`, `generatedFeatures`: the stored catalogs                                  |
| `src/backend/features/generated-parts/records.ts`                | `generatedConfiguration`: a studio's records as a load stores them                                               |
| `src/backend/lib/onshape/endpoints/blob-elements.ts`             | `getBlobText`: a file tab's contents                                                                             |
| `src/backend/features/load/load-group.ts`                        | `readGeneratedTabsStep`: which tabs the version's manifests name, storing each's catalog                         |
| `src/backend/features/load/load-insertable.ts`                   | `probeInsertable`: a generated tab's records come from `generatedConfiguration`                                  |
| `src/backend/features/generated-parts/studios.ts`                | `StudioLocation`; client-safe                                                                                    |
| `src/frontend/components/generated-badge.tsx`                    | `GeneratedBadge`: the FeatureScript mark, blue, in the build status card's header                                |
| `src/frontend/features/build-status/components/build-status.tsx` | Leaves out the configuration section for a generated part, which indexes every configuration                     |

robot-code owns each set's definition. For the fasteners it's
`featurescripts/fasteners/fastenerTables.py`, which writes three things from
one list of records:

- the FeatureScript's tables;
- each Part Studio's configuration;
- the manifest, with one record per configuration.

Each release writes the manifest into the library document as a file tab named
`<set>.parts.json` (`fasteners.parts.json`). For each studio it names:

- its tab (`elementId`);
- its feature;
- the id the feature gives its mate connector (`mateConnector`);
- its configuration and records.

The rest of the manifest is the set's catalog, which Auto Assembly reads.

## Storage

**D1** `insertables.is_generated` — whether the tab is a generated Part Studio.
Written by each load.

The records themselves are stored as any indexed insertable's are: the
default's in `insertables.part_metadata`, the rest in `configurations.records`.

**D1** `generated_sets` — one row per library and set, holding what a load
can't store on the set's insertables:

- `catalog`: the manifest less its studios. Auto Assembly sizes fasteners by
  it (screw lengths, nut heights, washer thicknesses), checked against its
  `catalogSchema`.
- `features`: each studio's tab, feature type and mate connector id, by its key
  (`GeneratedFeature`). Auto Assembly finds each kind's insertable by its tab,
  and insert and fasten finds the mate connector in any Part Studio using the
  feature.
- `group_id`: the group it was read from, so it's deleted with the group.

Replaced by each load of the group releasing it. The studios' records aren't
kept here: a load reads them from the version it loads, in Onshape.

## Flows

### Loading a generated tab

`loadGroup`, after reading the document's contents:

1. `findManifestTabs` finds the version's file tabs named `*.parts.json`. With
   none, no tab is generated, and the load goes on as for any document.
2. `readGeneratedTabsStep` downloads each (`getBlobText`, one call each),
   checks it (`parseManifest`), and stores its catalog and features in
   `generated_sets` (`releasedCatalog`, `saveGeneratedSet`). It returns only
   which tab is which set's studio (`generatedTabs`), since a step returns at
   most 1 MiB. An invalid manifest fails the group's load at once
   (`NonRetryableError`).
3. Each such tab's `InsertableTarget` carries its `generated` set and key.

`probeInsertable`, after reading the tab's configuration (one Onshape call):

1. A tab with no `generated` loads as any tab.
2. `readReleasedStudioStep` downloads its manifest again (one call) and keeps
   its own studio (`releasedStudio`): its feature, mate connector and records.
   A studio that won't fit in a step fails the tab (`Manifest too large`).
3. The default configuration's record is its part metadata, every other
   configuration's is a record, and the records' vendors are its vendors. No
   configuration is probed, and `decideIndexing` isn't consulted.

The default parts are still read, for the thumbnail and the composite check.
So is fasten info.

Insert and fasten is always on for a generated tab. Every load sets it, and
the toggle refuses to change it (`refuseGenerated`). Its mate connector is the
one its feature makes, found by the feature's type (`generatedFeatures`, or
the tab's own studio before any set is stored). A fasten mate names it
`<featureId>.<mateConnector>`, since Onshape's API shows no mate connector a
feature makes (`parseFastenInfoFromPartStudio`). robot-code checks that each
generated feature makes exactly one.

A tab is loaded when its microversion changes, as any is. A release rebuilds
every studio, which changes each.

### Changing a generated part

1. Change the definition in robot-code. Its tests check the records against
   the configurations offered.
2. Try it in robot-code's backend document: `fs parts fasteners --test` builds
   each Part Studio as `<Part> (TEST)` in the branch's workspace.
3. To load it in a local app, release it to a document of your own:
   `fs parts fasteners --release --target <name or url>`. Add that document as
   a group of a local library and load it.
4. Release it from a release file on main (`fs parts fasteners --release`).
   robot-code versions the backend document, points the library document's
   Feature Studio at that version, builds each Part Studio there, and writes
   the manifest beside them. The fasteners are a part set in robot-code
   (`[tool.fs.parts.fasteners]`; see its part sets doc).
5. Version the library document in Onshape, then load the group. Auto Assembly
   reads the new catalog from that load, with no deploy.

### Indicator

The build status carries `isGenerated`. It puts `GeneratedBadge` beside the
part's name in the build status card, and hides the indexing section and the
insert and fasten switch. The library list's rows don't mark it.

## Invariants

- A generated tab's records are robot-code's, never probed: one per
  configuration, read from the manifest in the version the load reads.
- A generated tab's configuration and its records come from the same release,
  so a load takes the records without comparing them to the configuration.
- A generated part's indexing isn't configurable: the indexing routes refuse it
  (400), and the load ignores its stored settings.
- A generated studio holds one feature, the set's, which makes exactly one mate
  connector: insert and fasten names it by that feature's id.
- A set's stored catalog is the one released in the version its group last
  loaded.

## Failure and recovery

| Failure                               | Result                                             | Recovery                                                  |
| ------------------------------------- | -------------------------------------------------- | --------------------------------------------------------- |
| Invalid manifest                      | The group's load fails, `LOAD_FAILED` on the group | Release the set again                                     |
| Failed to find manifest's part studio | That tab's load fails                              | Release the set again                                     |
| Manifest too large                    | That tab's load fails                              | Split what the step returns (records apart from the rest) |
| Catalog not one Auto Assembly reads   | Auto Assembly says no fasteners are loaded         | Release the set and deploy the app together               |

## Decisions

- **The manifest names each feature's mate connector.** A fasten mate names a
  mate connector a feature made `<featureId>.<id>`, and Onshape's API shows no
  such connector. So robot-code says the id each feature gives it.
- **No check of the configuration against the records.** robot-code writes
  both in one release, and a load reads both from one version, so they can't
  disagree.
- **In the library's documents, not a library of their own.** Generated parts
  are found, favorited and inserted like any part, so they share all of it.
- **Released beside the tabs, not synced or evaluated.** Onshape's FeatureScript
  evaluation only sees std, so a load can't ask the feature for its table.
  Read from the version a load reads, the records need no app deploy, and a new
  part set needs no app change.
- **The catalog is stored at load.** What Auto Assembly offers is what the
  library loaded, so a release reaches it with the group's next load.
- **A flag on the insertable, and the rest in `generated_sets`.** An insertable
  only needs to know it's generated. What belongs to the whole set (its
  catalog, and which tab and feature each studio is) is stored once, with the
  set.

_Last reviewed: 2026-11-09_
