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
from the manifest it releases beside the Part Studios, rather than asking
Onshape about each configuration. So they have no indexing limit and no admin
indexing controls, and the generator is the source of truth: a tab configured
otherwise fails its load.

Parts modeled by hand aren't generated, whatever their configuration.

## Code map

| Path                                                                 | Role                                                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `scripts/sync-generated-parts.js`                                    | `npm run sync:generated-parts`: copies robot-code's manifests in at a pinned commit           |
| `src/backend/features/generated-parts/manifest.ts`                   | The released manifest: `findManifestTabs`, `parseManifest`, `generatedTabs`, `releasedStudio` |
| `src/backend/features/generated-parts/records.ts`                    | `generatedConfiguration`, `describeMismatch`, `GeneratedPartMismatchError`; the server's      |
| `src/backend/lib/onshape/endpoints/blob-elements.ts`                 | `getBlobText`: a file tab's contents                                                          |
| `src/backend/features/load/load-group.ts`                            | `readGeneratedTabsStep`: which tabs the version's manifests name                              |
| `src/backend/features/load/load-insertable.ts`                       | `probeInsertable`: a generated tab's records come from `generatedConfiguration`               |
| `src/backend/features/generated-parts/studios.gen.ts`                | The synced studios, for Quick fastener: each one's configuration, and where it's released     |
| `src/backend/features/generated-parts/studios.ts`                    | `GENERATED_STUDIOS` parsed by `parseOnshapeConfiguration`, `getGeneratedStudio`; client-safe  |
| `src/frontend/features/library/components/generated-badge.tsx`       | `GeneratedBadge`: the library card's FeatureScript mark                                       |
| `src/frontend/features/build-status/components/indexing-section.tsx` | Says a generated part indexes every configuration, in place of the indexing switches          |

robot-code owns each set's definition: for the fasteners,
`featurescripts/fasteners/fastenerTables.py`, which writes the FeatureScript's
tables, each Part Studio's configuration and the manifest
(`fasteners.gen.json`) from one list of records, one per configuration
the configuration offers (`ConfiguredStudio.combinations()`). Each release
writes that manifest into the document it releases to, as a file tab named
`<set>.parts.json` (`fasteners.parts.json`), with each studio's tab there
(`elementId`) and its configuration and records. Its features set
exactly the properties the records name. An input shows only where more than
one of its options is made, and is left out of a record where it's hidden, as
`enumerateConfigurations` leaves it unset; one with a single option anywhere
(the nut's Vendor) isn't in the configuration at all.

## Storage

**D1** `insertables.generated_studio` — the generated studio a tab is, as
`set/key` (`fasteners/screw`); null for a tab modeled by hand. Written by each
load.

The records themselves are stored as any indexed insertable's are: the
default's in `insertables.part_metadata`, the rest in `configurations.records`.

The manifest isn't stored: a load reads it from the version it loads, in Onshape.

## Flows

### Syncing

`npm run sync:generated-parts -- <ref> [--from ../robot-code]` reads each set's
manifest at a robot-code commit and writes `studios.gen.ts`, on one line
(prettier would spread it over tens of thousands), and Quick fastener's own
files (see [quick-fastener.md](./quick-fastener.md)). Only Quick fastener reads
them: a library load reads the released manifest.

### Loading a generated tab

`loadGroup`, after reading the document's contents:

1. `findManifestTabs` finds the version's file tabs named `*.parts.json`. With
   none, no tab is generated, and the load goes on as for any document.
2. `readGeneratedTabsStep` downloads each (`getBlobText`, one call each), checks
   it (`parseManifest`), and keeps only which tab is which set's studio
   (`generatedTabs`): a step returns at most 1 MiB, which a whole manifest can
   pass. A manifest it can't read fails the group's load at once
   (`NonRetryableError`), rather than retrying what reads the same every time.
3. Each such tab's `InsertableTarget` carries its `generated` set and key.

`probeInsertable`, after reading the tab's configuration (one Onshape call):

1. A tab with no `generated` loads as any tab.
2. `readReleasedStudioStep` downloads its manifest again (one call) and keeps
   its own studio (`releasedStudio`): its feature, configuration and records,
   about 400 KB for the screw.
3. `describeMismatch` checks the tab's parameters against the studio's: the
   same parameters, names, defaults and options, offering exactly the
   configurations there are records for (enumerated with
   `enumerateConfigurations`, so conditions Onshape spells differently but which
   show the same pass).
4. A mismatch throws `GeneratedPartMismatchError`: the tab fails, keeps its last
   good load, and is flagged `GENERATED_PART_MISMATCH` and `LOAD_FAILED`; its
   group keeps its last good version.
5. Otherwise the default configuration's record is its part metadata, every
   other configuration's is a record, and the records' vendors are its vendors.
   No configuration is probed, and `decideIndexing` isn't consulted.

The default parts are still read (for the thumbnail and the composite check), as
is fasten info when it's on. Insert and fasten is on for a generated tab from its
first load, which an editor can turn off; its mate connector is the one its
studio's only feature, the set's, makes (`parseFastenInfoFromPartStudio`). A tab is loaded when its microversion changes, as
any is; a release rebuilds every studio, which changes each.

### Changing a generated part

1. Change the definition in robot-code, which writes the FeatureScript's tables
   from the records; its tests check the records against the configurations
   offered.
2. Push it to robot-code's backend document and try it there:
   `fs parts fasteners --test` builds each Part Studio as `<Part> (TEST)` in the
   branch's workspace, from the FeatureScript as pushed.
3. To load it in a local app, release it to a document of your own:
   `fs parts fasteners --release --target <name or url>` builds the Part
   Studios there, writes the manifest beside them, and versions it, without
   numbering, recording or tagging anything. Add that document as a group of a
   local library and load it.
4. Release it (`fs parts fasteners --release`, from a release file on main):
   robot-code points the library document's Feature Studio at a new backend
   version, builds each Part Studio there from the definition, writes the
   manifest beside them, versions the library document, and records where each
   studio is (`fastenerTables.studios.json`). Nothing is made by hand. The
   fasteners are a part set in robot-code (`[tool.fs.parts.fasteners]`; see its
   part sets doc), released apart from its user-facing FeatureScript.
5. Load the group: its new version's manifest is read with it, so no sync or
   deploy comes between. Quick fastener still inserts the synced studios, so
   sync the release's commit here and deploy for it.

### Indicator

`InsertableOut.isGenerated` puts `GeneratedBadge` beside the library card's
title. The build status carries `generatedStudio`, and the indexing section
shows it in place of the indexing switches.

## Invariants

- A generated tab's records are robot-code's, never probed: one per
  configuration its configuration offers, read from the manifest released in
  the version the load reads.
- A tab whose configuration isn't its studio's fails its load; nothing about it
  is stored from that load.
- A generated part's indexing isn't configurable: the indexing routes refuse it
  (400), and the load ignores its stored settings.
- The generator's records and the FeatureScript's properties are written from
  the same definition, so what the library indexes is what the part says.
- A generated studio holds one feature, the set's, which makes exactly one mate
  connector: insert and fasten names it by that feature's id.

## Failure and recovery

| Failure                                         | Result                                                 | Recovery                                                      |
| ----------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| The tab's configuration isn't the generated one | `GENERATED_PART_MISMATCH`; it keeps its last good load | Release the fasteners again (`fs parts fasteners --release`)  |
| A manifest isn't JSON, or isn't a manifest      | The group's load fails, `LOAD_FAILED` on the group     | Release the set again                                         |
| A manifest names a tab but has no studio for it | That tab's load fails                                  | Release the set again                                         |
| A studio's part of a manifest passes 1 MiB      | That tab's step fails                                  | Split what the step returns (configuration and records apart) |
| Quick fastener's studio location isn't synced   | Quick fastener can't insert it                         | Sync the commit with the release's recorded locations         |

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
- **Released beside the tabs, not synced or evaluated.** Onshape's FeatureScript
  evaluation only sees std, so a load can't ask the feature for its table;
  robot-code writes the records as a file tab in the version it releases. Read
  from that version, they can't disagree with the tabs, a release needs no app
  deploy, a document released to for testing loads like any, and a new part set
  needs no app change.

_Last reviewed: 2026-10-22_
