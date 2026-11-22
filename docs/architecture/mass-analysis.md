# Mass Analysis

## Purpose

Shows where an assembly's mass is, and fixes the parts that have none. It acts
on whatever assembly Onshape launched the app from, under the caller's own
Onshape permissions; the library's access levels have no say over it.

The page has two halves, both at the level opened:

- A treemap of the level's parts and subassemblies, each tile sized by its mass.
  A subassembly's tile opens into its own parts, unless it's a library's. A
  breadcrumb climbs back out.
- A list of the parts below the level with no mass. Each can have its material
  or its mass override set, where its document allows.

It reads masses; it doesn't compute them. A part's mass is what the
assembly's bill of materials says, which Onshape works out from the part's
material, or takes from its mass override.

It is not a library feature. It stores nothing, and its tab is listed only
where there is an element to act on, as Auto Assembly's is.

## Code map

In the order the page runs: the report, the chart, then a save.

`src/frontend/routes/app/mass-analysis.tsx`

```ts
// A notice outside an assembly, or signed out; the panel otherwise.
function MassAnalysisPage(): ReactNode;
```

`src/frontend/features/mass-analysis/components/mass-analysis-panel.tsx`

```ts
// The level opened is the panel's own state, a path of subassembly row ids.
function MassAnalysisPanel({ assembly }: MassAnalysisPanelProps): ReactNode;

interface MassAnalysisPanelProps {
    assembly: ElementPath;
}
```

`src/frontend/features/mass-analysis/queries.ts`

```ts
// Read again only on a refresh or a save: each read is a BOM from Onshape.
function useMassReportQuery(assembly: ElementPath);
// Invalidates the report once Onshape took the change.
function useSetPartPropertiesMutation(assembly: ElementPath);
```

`src/backend/features/mass-analysis/routes.ts`

```text
GET  /api/mass-analysis?documentId=&instanceType=&instanceId=&elementId=
POST /api/mass-analysis/part
```

`src/backend/lib/onshape/endpoints/assemblies.ts`

```ts
// Every row of every level, subassemblies expanded, including what the BOM
// excludes and ignoring each subassembly's BOM behavior.
function getAssemblyBom(
    client: OnshapeApi,
    assemblyPath: ElementPath
): Promise<OnshapeBom>;
```

`src/backend/features/mass-analysis/bom.ts`

```ts
// The BOM's rows as a tree. A row is a subassembly when the row after it is
// deeper, or it names no part; one added by hand is left out.
function toMassReport(bom: OnshapeBom, context: BomContext): MassReportOut;
// A number, a string with units, or an object holding either; kilograms.
function parseMass(value: unknown): number | undefined;

interface BomContext {
    assembly: ElementPath;
    /** Every document a library loads from. */
    libraryDocumentIds: ReadonlySet<string>;
}
```

`src/backend/features/mass-analysis/contract.ts`

```ts
/** A part, by the Part Studio the assembly references it from. */
interface PartSource extends ElementPath {
    partId: string;
    /** As the BOM row encodes it; empty for the default. */
    configuration: string;
}

enum MassNodeKind {
    PART = "part",
    ASSEMBLY = "assembly"
}

interface MassNodeBase {
    /** The BOM row's, unique within the report. */
    id: string;
    name: string;
    /** How many of it one of its parent holds. */
    quantity: number;
}

interface MassPart extends MassNodeBase {
    kind: MassNodeKind.PART;
    /** Kilograms, for one; undefined when Onshape has no mass for it. */
    mass?: number;
    material?: string;
    source: PartSource;
    /** Its Part Studio is in the assembly's own workspace. */
    canSetMaterial: boolean;
    /** Its document is no library's. */
    canSetMass: boolean;
}

interface MassAssembly extends MassNodeBase {
    kind: MassNodeKind.ASSEMBLY;
    /** A library's: its mass counts, but it isn't opened or listed. */
    isLibrary: boolean;
    children: MassNode[];
}

type MassNode = MassPart | MassAssembly;

/** GET /api/mass-analysis: the assembly's own items, each subassembly with its own. */
interface MassReportOut {
    children: MassNode[];
}

/** POST /api/mass-analysis/part: at least one of `material` and `mass`. */
interface PartPropertiesIn {
    assembly: ElementPath;
    part: PartSource;
    /** A name from `MATERIALS`. */
    material?: string;
    /** Kilograms, set as the part's mass override. */
    mass?: number;
}
```

`src/backend/features/mass-analysis/materials.ts`, a leaf the frontend lists

```ts
/** What a part's material can be set to: robot-code's `robotProperties.fs` materials. */
const MATERIALS: readonly Material[];
function findMaterial(name: string): Material | undefined;

interface Material {
    /** As Onshape's material library names it. */
    name: string;
    /** Kilograms per cubic metre. */
    density: number;
}
```

`src/frontend/features/mass-analysis/mass-data.ts`

```ts
// Kilograms, of every one the parent holds; a part with no mass adds nothing.
function totalMass(node: MassNode): number;
function sumMass(nodes: MassNode[]): number;
// Whether a tile opens into its parts: a subassembly no library's.
function canOpen(node: MassNode): node is MassAssembly;
// As deep along `path` as the report still goes.
function findLevel(report: MassReportOut, path: string[]): MassLevel;
// Pounds, heaviest first; massless items are left out.
function toTiles(children: MassNode[], hue: string): MassTile[];
// Each part below the level with no mass, once, but those in a library's assembly.
function missingParts(children: MassNode[]): MissingPart[];

interface MassLevel {
    /** The subassemblies opened to reach it, outermost first. */
    trail: MassAssembly[];
    children: MassNode[];
}

/** A treemap tile; its area is its share of the level's mass, in pounds. */
interface MassTile {
    id: string;
    name: string;
    value: number;
    color: string;
}

/** A part with no mass, once however many times it's placed. */
interface MissingPart {
    part: MassPart;
    /** How many the level holds, through every subassembly. */
    count: number;
    /** The subassembly it's first found in, below the level; undefined at the level itself. */
    within?: string;
}
```

`src/frontend/features/mass-analysis/components/mass-treemap.tsx` and
`missing-mass-list.tsx` draw the two halves. The treemap is
`src/frontend/components/app-treemap.tsx`, which the dashboard's usage treemap
shares.

`src/backend/lib/onshape/endpoints/metadata.ts`

```ts
// A part's own properties, without the computed ones.
function getPartMetadata(
    client: OnshapeApi,
    part: PartMetadataPath
): Promise<OnshapePartMetadata>;
function updatePartMetadata(
    client: OnshapeApi,
    part: PartMetadataPath,
    properties: { propertyId: string; value: unknown }[]
): Promise<void>;

/** A part, by the Part Studio it's in; `configuration` is as Onshape encoded it. */
interface PartMetadataPath {
    studio: ElementPath;
    partId: string;
    configuration: string;
    /** The document it's reached through, when it's another's version. */
    linkDocumentId?: string;
}
```

`src/backend/features/analytics/tracking.ts`: `trackMassReport` and
`trackMassEdit` (see [analytics.md](./analytics.md)).

## Storage

None. The report lives in the client's query cache for the page's life, and is
read again on a refresh or after a save. A part's material and mass override
are Onshape's, on the part.

## Flows

### Finding the page

1. The page picker lists Mass Analysis under Utilities whenever the panel was
   opened on an element, or the page is showing.
2. Outside an assembly the page is a notice saying to open it from one. Signed
   out, it is a notice with a sign-in button.
3. `/` resumes into it only when the launch names an element, as for Auto
   Assembly (`canResume` in `src/frontend/routes/index.tsx`).

### Reading the report — `GET /api/mass-analysis`

1. Signed in only (`requireSignInMiddleware`).
2. Reads the assembly's BOM as the caller (`getAssemblyBom`), and the library
   document ids from `groups`, at once.
3. `toMassReport` turns the rows into a tree:
    - Columns are found by header name: Name, Quantity, Mass and Material.
      Mass override is a column of its own and isn't read.
    - A subassembly's rows follow it one level deeper.
    - A subassembly is a library's when its document is one a library loads
      from, or it's inside one that is.
    - A part may have its material set when its Part Studio is in the
      assembly's own workspace. It may have its mass set unless it is in a
      library's document or assembly, or pinned to a microversion.
4. Records `MASS_REPORT` in the background, and answers the tree.

### The page

1. The level opened starts at the assembly's own items.
2. The chart's caption is the level's total, in pounds. Tiles are the level's
   items with any mass, heaviest first and darkest.
3. Clicking a subassembly's tile opens it, unless it is a library's. Clicking
   a part does nothing.
4. The breadcrumb lists each level above, back to the assembly.
5. The list below holds each part with no mass under the level, once, with the
   count the level holds. Parts inside a library's assembly aren't listed.
6. A library's part is listed with nothing to set. Another document's part has
   its material dropdown disabled, with a line saying why.

### Saving a part — `POST /api/mass-analysis/part`

1. Signed in only. The body names a material from `MATERIALS`, a mass in
   kilograms, or both. The page sends the mass typed in pounds as kilograms.
2. Refuses a material for a part outside the assembly's own workspace, and
   anything for a library's part, before calling Onshape.
3. Reads the part's metadata, to find the Material and Mass override
   properties' ids. One that's missing, or that Onshape marks not editable, is
   refused.
4. Writes both in one metadata update. Another document's part is reached
   through the assembly's document (`linkDocumentId`), at the version the
   assembly references.
5. Records `MATERIAL_SET` and `MASS_OVERRIDE_SET`, one for each property set,
   in the background.
6. The page invalidates the report, which reads the BOM again.

## User-facing strings

[docs/strings/mass-analysis.md](../strings/mass-analysis.md).

## Invariants

- Nothing is written to a library's document, or to a part inside a library's
  assembly. The server checks, whatever the client sends.
- A material is only ever set in the assembly's own workspace.
- Masses cross the API in kilograms. Only the page converts, to and from
  pounds.
- Every mass in the report is Onshape's: the app never computes one from a
  material and a volume.
- A library's subassembly counts toward every total above it, but is never
  opened and its parts are never listed.
- Each report read and each property set records its event, after the work,
  in the background.

## Failure and recovery

- **Onshape refuses the write** (no edit access to the other document, or a
  property it won't change): the save's toast says it failed, and the row stays
  as it was.
- **The BOM's cells aren't in a shape `parseMass` reads**: the part shows as
  having no mass. The shapes are unverified (see
  [ONSHAPE.md](../ONSHAPE.md#bill-of-materials-and-part-metadata)); a fix goes
  in `bom.ts` alone.
- **The report goes stale** while someone edits the assembly in Onshape: the
  refresh button reads it again.

## Decisions

- **The BOM, not the assembly definition.** One call answers every part's mass
  and material at every level, already including mass overrides. The assembly
  definition has no masses, so it would cost a metadata call per Part Studio
  besides.
- **Excluded rows and subassembly BOM behavior are ignored.** A part left out
  of a team's BOM still weighs something.
- **A library's subassembly doesn't open.** Its parts are the library's to fix,
  and the caller can't write to them.
- **Materials are a fixed list**: the ones robot-code's FeatureScripts use.
  Onshape's full library would need its document's ids, and FRC parts are
  nearly all from these.
- **Pounds on the page.** FRC's weight limit is in pounds. Onshape's document
  units have no mass unit the app reads.
- **No server cache.** A cache keyed by the workspace would need a call to find
  its microversion, and the report must reflect a save at once.
