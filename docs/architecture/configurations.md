# Configurations

## Purpose

Onshape parts are configurable: a part studio or assembly declares parameters
(lists, checkboxes, quantities, text) and each combination of values is a
different part. This area parses those parameters, represents what someone
picked, sends it back to Onshape on insert, and enumerates combinations so
search can find a part by any configuration's part number.

It does not own rendering a configuration's picture ([thumbnails.md](./thumbnails.md))
or the load that probes Onshape ([loading.md](./loading.md)); both consume it.

## Code map

| Path                                                                 | Role                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/backend/features/configurations/contract.ts`                    | Parameter, `Selection`, `ConfigurationKey`, record and result types    |
| `src/backend/features/configurations/selection.ts`                   | The only place a selection or key is built; see the invariants         |
| `src/backend/features/configurations/utils.ts`                       | Visibility conditions, option resolution, configuration text encodings |
| `src/backend/features/configurations/input-parser.ts`                | Parses and evaluates typed quantity expressions (`(2 + 3) in`)         |
| `src/backend/features/configurations/combinations.ts`                | Indexing limits and bands, enumeration and counting of combinations    |
| `src/backend/features/configurations/roles.ts`                       | Recognizes parameter roles by name (derivation variable, color, ...)   |
| `src/backend/features/configurations/instances.ts`                   | Splits a parameter by the choices that filter it, for reporting        |
| `src/backend/features/configurations/units.ts`                       | A workspace's display units, cached in KV                              |
| `src/backend/features/configurations/part-number.ts`                 | Placeholder and meaningless part numbers                               |
| `src/backend/features/configurations/routes.ts`                      | `GET /api/configuration/...`, `GET /api/unit-info`                     |
| `src/backend/features/load/parse-configuration.ts`                   | Onshape's configuration response to our parameters, roles attached     |
| `src/backend/features/load/parse-configuration-records.ts`           | `decideIndexing`, probing each combination into a record               |
| `src/backend/features/search/records.ts`                             | Records to search records, each with its thumbnail key                 |
| `src/frontend/features/insert/components/configurations.tsx`         | The parameter panel in the insert menu                                 |
| `src/frontend/features/build-status/components/indexing-section.tsx` | Admin indexing controls                                                |

## Storage

**D1**

- `configurations` — one row per insertable that has parameters: `parameters`
  (the parsed declarations) and `records` (one per probed combination: its
  values and the part number, name, material and vendor Onshape reported). Its
  own table, since both columns are large.
- `insertables.part_metadata` — the default configuration's part data, also the
  fallback record.
- `insertables.index_configurations` — an admin enabled indexing past the
  automatic threshold.
- `insertables.excluded_parameter_ids` — parameters an admin left out of
  indexing.

**KV**: `unit-info:` — a workspace's display units, for a week; a transient
Onshape webhook drops the entry when the units change.

**URL**: the `config` app parameter carries the selection being edited, so a
link reopens it.

## The two forms

`AGENTS.md` states the rule; this is the reasoning.

- **Selection** (`Selection`): every declared parameter, each value **as
  entered**. A quantity keeps the expression typed, `(2 + 3) in`, and a
  quantity's default is spelled in its own unit, `1 in`. It is what is stored,
  what the url carries, and what Onshape is sent, so a derived feature in
  Onshape shows what the person typed. `toSelection` makes one from anything: a
  search hit, a favorite, a request body, the url.
- **Configuration key** (`ConfigurationKey`): derived from a selection only to
  name its thumbnail. It holds what the selection overrides, canonically spelled
  (base units, hidden parameters and derivation variables left out), so
  selections that render the same part share a render.
  `DEFAULT_CONFIGURATION_KEY` is the empty string.

Comparing or counting values (analytics, "is this the default") goes through
`canonicalValue` / `canonicalValues`.

## Flows

### Parsing, during a load

1. The load fetches the element's configuration and `parse-configuration.ts`
   turns it into `ConfigurationParameter`s, visibility conditions included.
2. `withRoles` marks parameters whose names say they are a derivation variable,
   a color or its channels, or tessellation. A parameter with a role is never
   indexed; no list or checkbox in the libraries has one yet, so today that
   excludes nothing.
3. The parameters are stored on the `configurations` row.

### Indexing

1. `countConfigurations` enumerates the combinations of the **indexed**
   parameters: enums and booleans without a role, minus
   `excluded_parameter_ids`. Visibility is honored, so a hidden parameter keeps
   its default.
2. The count sets the band: under `AUTO_INDEX_THRESHOLD` (128) indexes
   automatically; at or above it indexes only with `index_configurations`
   (`MANUAL_INDEXING_REQUIRED` otherwise); past
   `MAX_PART_NUMBER_CONFIGURATIONS` (512) never (`CONFIGURATION_LIMIT_EXCEEDED`).
3. `decideIndexing` returns the combinations; `parseConfigurationRecords` probes
   each in batches of 20, with only the values that differ from the defaults
   sent, and stores a record per combination.
4. Changing the exclusions or the indexing switch re-runs this for one element
   immediately (`POST /api/excluded-parameters/...`,
   `POST /api/index-configurations/...`).

The admin card counts with the same functions, so it cannot disagree with the
load about the band.

### Configuring and inserting

1. The insert menu fetches `GET /api/configuration/insertable/:id?v={microversion}`,
   pinned to the microversion so it never refetches mid-edit.
2. The panel keeps a selection. `normalizeSelection` settles it after each edit:
   hidden parameters take their default and an enum lands on a visible option,
   repeated because settling one parameter can change another's options.
3. The panel gives each derivation variable still at its default a unique
   value (`fillDerivationValues`), so each derive is its own configuration.
   An insert that skips the menu leaves it at its default.
4. The panel reports the selection and its key; the key drives the preview
   thumbnail.
5. On insert, the server makes the selection whole (`toSelection`) and sends
   only the overrides (`onshapeOverrides`). Onshape refuses a part studio's
   empty configuration (an assembly's is fine), so a part studio left on its
   defaults is sent its first parameter at its default.

### Search

Each record becomes a search record carrying its values and key
(`search/records.ts`), so a hit on a configuration's part number opens that
configuration and shows its thumbnail. `findRecord` picks the most specific
record for a selection, since records name only what enumeration varied.

## Invariants

- `selection.ts` is the only place a `Selection` or `ConfigurationKey` is built,
  and there are only these two forms.
- A selection is never replaced by its key in storage, and a key is never sent
  to Onshape as a configuration, a render's included: Onshape names a render by
  the value it computes from what was typed, which a key's base units round.
- Every boundary that receives a configuration (request body, url, stored
  favorite, search hit) passes it through `toSelection`.
- Stored and shared selections omit derivation variables (`toStoredSelection`).
- Parameters with a role are never indexed.
- The load and the admin UI decide the indexing band with the same
  `combinations.ts` functions.

## Failure and recovery

| Failure                                         | Result                                                               | Recovery                                             |
| ----------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| A combination doesn't regenerate in Onshape     | That probe fails; the batch retries, then the load flags the element | Fix the part in Onshape; the next version reloads it |
| Too many combinations                           | Not indexed; build issue                                             | Exclude parameters in the Indexing section           |
| Units change in a workspace                     | Cached units drop via webhook, or expire in a week                   | Automatic                                            |
| A parameter is added after a favorite was saved | Favorite's selection is short one parameter                          | `toSelection` defaults it on read                    |

## Decisions

- **Selections keep what was typed.** Sending Onshape the canonical value would
  turn a derived feature's `(2 + 3) in` into `0.127 m`.
- **Keys exist only for thumbnails.** Anything else built on a key would inherit
  its lossy canonicalization; comparisons use `canonicalValues`.
- **Roles by name.** Onshape doesn't mark a parameter's purpose, so recognized
  names are stored as `role` at load.
- **Derivation variables are filled in the menu.** Onshape takes a repeated
  derive of the same configuration; the unique value only keeps each derive
  distinct, which is the menu's concern, not the server's.
- **Assemblies index like part studios.** Their probes send overrides the same
  way, so exclusions apply to both.

_Last reviewed: 2026-09-27_
