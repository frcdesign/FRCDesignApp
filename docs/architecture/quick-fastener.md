# Quick fastener

## Purpose

Putting a screw, and a washer and nut where they're wanted, in each hole picked
in an assembly: sized to the hole, and long enough to go through everything on
its axis. It acts on whatever assembly Onshape launched the app from, under the
caller's own Onshape permissions; the library's access levels have no say over
it.

It inserts only standard fasteners: the lengths and parts the catalog says each
vendor makes. It has no FTC fasteners yet.

## Code map

| Path                                                                        | Role                                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `scripts/sync-quick-fastener.js`                                            | `npm run sync:quick-fastener`: copies robot-code's manifest in at a pinned commit        |
| `src/backend/features/quick-fastener/catalog.gen.ts`                        | The synced catalog: studios, vendors, sizes, heads, screws, nuts, washers, seat washers  |
| `src/backend/features/quick-fastener/hole-scan.gen.ts`                      | The synced hole scan: the FeatureScript lambda evaluated in each Part Studio             |
| `src/backend/features/quick-fastener/catalog.ts`                            | The catalog's types and lookups, and each studio's configuration; client-safe            |
| `src/backend/features/quick-fastener/contract.ts`                           | `FastenerOptions`, `QuickFastenerIn`, `PlannedHole`, `HoleStatus`, `HoleEnd`             |
| `src/backend/features/quick-fastener/geometry.ts`                           | Vectors, Onshape's 4×4 transforms, `LINEAR_TOLERANCE`                                    |
| `src/backend/features/quick-fastener/scan.ts`                               | `scanStudio`: evaluates the hole scan, decodes it, caches it                             |
| `src/backend/features/quick-fastener/assembly.ts`                           | Part occurrences and what pins each one's Part Studio; holes and circles in the assembly |
| `src/backend/features/quick-fastener/gather.ts`                             | `gather`: reads the assembly and scans every Part Studio it needs                        |
| `src/backend/features/quick-fastener/planner.ts`                            | `planHoles`: the fastener for each hole; pure                                            |
| `src/backend/features/quick-fastener/insert.ts`                             | `placements` and `insertFasteners`: inserting and fastening each hole's parts            |
| `src/backend/features/quick-fastener/routes.ts`                             | The two routes below                                                                     |
| `src/frontend/lib/selection.ts`                                             | Onshape's SELECTION messages, and the one query list taking picks                        |
| `src/frontend/components/query-list.tsx`                                    | `QueryList`: Onshape's query parameter, for entities picked in the Onshape window        |
| `src/frontend/features/quick-fastener/options.ts`                           | Default options, `consistentOptions`, `describePlan`                                     |
| `src/frontend/features/quick-fastener/store.ts`                             | The page's options (kept) and picks (not)                                                |
| `src/frontend/features/quick-fastener/components/quick-fastener-panel.tsx`  | The page: what to fasten, with what, preview and insert                                  |
| `src/frontend/features/quick-fastener/components/fastener-options-form.tsx` | The options                                                                              |
| `src/frontend/routes/app/quick-fastener.tsx`                                | The route; a notice outside an assembly                                                  |

robot-code (`robot-education/robot-code`) owns everything the catalog says:
`featurescripts/quickFastener/quickFastenerTables.py` generates the features'
FeatureScript data, the Part Studios' configurations, and the manifest synced
here, and `quickFastenerHoleScan.fs` is the hole scan.

## Storage

**KV** `quick-fastener-scan:{key}` — a Part Studio's holes, by part id, for a
month. The key is what pins the Part Studio's geometry and its configuration
(`toStudioSource`): `{documentId}|v|{versionId}|…` for a part from a version,
`{documentId}|e|{elementMicroversionId}|…` for one from the assembly's own
workspace, and `{documentId}|m|{documentMicroversionId}|…` otherwise.

**KV** `quick-fastener-mate-connector:{documentId}|{versionId}|{elementId}` —
the mate connector feature id a released studio's part has in an assembly,
with no expiry.

**Browser** `quickFastener` in `localStorage` — the options. What's picked is
held only while the page is open.

## Flows

### Picking

1. Onshape sends `SELECTION` with the whole selection whenever it changes, once
   `applicationInit` has been sent; `parseSelections` keeps its entities.
2. Clicking a `QueryList` focuses it (one at a time, `useOnshapeSelection`) and
   shows its prompt in Onshape's bubble. Each later SELECTION hands the focused
   list what's new in it; the list keeps the edges and faces, and repeats its
   prompt for anything else.
3. Hovering a row lights its entity up (`requestSelectionHighlight`), and
   leaving it stops the request.

### Planning — `POST /api/quick-fastener/plan`

1. Reads the assembly definition, and, when any part is from the assembly's own
   workspace, its Part Studios' microversions (one listing).
2. Walks each occurrence into subassemblies to its part instance, and pins its
   Part Studio (`partOccurrences`).
3. Scans each distinct pinned Part Studio once, six at a time: from the cache
   unless something is picked in it, by evaluating the hole scan otherwise,
   with the picked edges and faces as `qTransient` queries. Fasteners of the
   catalog's own studios and standard content aren't scanned.
4. Moves every part's holes, and the picked circles (an edge's own, or every
   circular edge of a face), into the assembly; drops the skipped ones.
5. `planHoles`, for each circle:
    1. A Quick fastener screw already on its axis, seated there: **fastened**.
    2. Every hole on the axis, nearest first. The first must start at the circle
       (or within a flat head's countersink of it).
    3. Size: a tapped hole further on that a size fitting the clearance hole
       taps, else the largest size the clearance hole fits, at most 1.35 times
       its diameter; preset, the chosen size, if it fits.
    4. Follow the holes: into a tapped hole of that size (threads, or a hole at
       its tap drill), to the bottom of a blind hole, or out the far side.
       Bridges gaps, unless up to next, and stops past the maximum length.
    5. Length, from the vendor's standard lengths for that size and head: the
       shortest reaching through the stack, its washers, its nut and two threads
       past it; or the longest that engages a diameter of thread (or all there
       is) short of a blind hole's bottom by a thread. Preset, the chosen length,
       if it does.
    6. A nut only out the far side, and only with a nut type; from the screw's
       vendor if it makes nuts, else Generic, mated to the far side's edge.
6. Answers each hole's plan.

### Inserting — `POST /api/quick-fastener/insert`

1. Plans again, as above.
2. Places each ready hole's parts (`placements`): the screw and its washer on
   the circle, the nut and its washer on the far side, turned over; a seated
   part above its edge by its seat washer.
3. Inserts them all in one `transformedinstances` call, from each studio's
   released version, with its configuration.
4. Reads each studio's mate connector id from the assembly, once per release.
5. Adds one fasten mate per part, one at a time: its mate connector to the
   center of the edge it sits on.

## Invariants

- The catalog is robot-code's, synced at a pinned commit; it's never edited
  here.
- Only standard fasteners are inserted: a length, nut or washer the catalog
  says its vendor makes.
- A screw's and nut's Washer input only moves its mate connector, by its
  vendor's seat washer, and the washer inserted under it is that seat washer.
  So every part is fastened to a hole's own edge, with no offset.
- A scan is keyed by something that never changes, so a cached scan is never
  stale and nothing invalidates it.
- Fasteners are only ever inserted into an assembly in a workspace.
- The plan inserted is the server's own, made in the insert request.
- Onshape decides who may insert: the routes need a session, and the insert
  is the caller's own Onshape call.

## Failure and recovery

| Failure                              | Result                                     | Recovery                                     |
| ------------------------------------ | ------------------------------------------ | -------------------------------------------- |
| The studios aren't released          | Insert answers 503                         | Fill robot-code's `LOCATIONS`, sync          |
| The hole scan fails in a Part Studio | The request fails, naming Onshape's notice | Fix the Part Studio, or skip what's in it    |
| No hole, or nothing fits             | That hole's plan is **no fit**, with why   | Change the options or the hole               |
| A mate fails partway                 | The parts so far stay, some unmated        | Mate the rest by hand, or undo and run again |
| Onshape rate-limits                  | The request fails with the rate limit      | Run it again                                 |

## Decisions

- **Two repos, one generated file between them.** robot-code holds the
  FeatureScript and its tooling; this repo pins its manifest. Inserting needs a
  released Onshape version anyway, so a monorepo would still need the pin.
- **Immutable keys, no webhooks.** A version, a document microversion and a
  tab's microversion each name geometry that can't change, so a scan keyed by
  one is cached for good, and the assembly's own reading says which key is
  current. A Part Studio deriving from another tab of its workspace keeps its
  tab's microversion when only that other tab changes; this is untried in
  Onshape.
- **The panel listens instead of requesting.** Onshape sends every selection
  change once the app has said it's ready, so a focused list takes what's new
  rather than holding a `requestSelection` open, which a highlight would cancel.
- **Mate connectors move, mates don't offset.** Mate offsets aren't in
  Onshape's API reference, and a washer's thickness belongs to the catalog, so
  the studio carries it.
- **Every scan is sent the picked ids, not a `queries` body.** The lambda is
  wrapped to build its queries from `qTransient`, whose form std documents.

_Last reviewed: 2026-10-21_
