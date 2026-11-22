# Mass Analysis

## Purpose

Shows where an assembly's mass is, and which parts have none. It acts
on whatever assembly Onshape launched the app from, under the caller's own
Onshape permissions; the library's access levels have no say over it.

The page has two halves, both at the level opened:

- A treemap of the level's parts and subassemblies, each tile sized by its mass.
  A subassembly's tile opens into its own parts, unless it's a library's. A
  breadcrumb climbs back out.
- A list of the parts below the level with no mass. Hovering one lights up
  every instance of it in Onshape.

It reads masses; it doesn't compute or change them. A part's mass is what the
assembly's bill of materials says, which Onshape works out from the part's
material, or takes from its mass override.

It is not a library feature. It stores nothing, and its tab is listed only
where there is an element to act on, as Auto Assembly's is.

## Code map

In the order the page runs: the report, then the chart and the list.

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
// Read again only on a refresh: each read is a BOM from Onshape.
function useMassReportQuery(assembly: ElementPath);
```

`src/backend/features/mass-analysis/routes.ts`

```text
GET /api/mass-analysis?documentId=&instanceType=&instanceId=&elementId=
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
function toMassReport(
    bom: OnshapeBom,
    libraryDocumentIds: ReadonlySet<string>
): MassReportOut;
// A number, a string with units, or an object holding either; kilograms.
function parseMass(value: unknown): number | undefined;
// Each a path of instance ids, joined by `/` or as an array.
function parseOccurrences(value: unknown): string[][];
```

`src/backend/features/mass-analysis/contract.ts`

```ts
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
    /** The same Part Studio, part and configuration wherever it's placed. */
    partKey: string;
    /** Each instance of it, as a path of instance ids from the assembly down. */
    occurrences: string[][];
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
// In `unit`, heaviest first; massless items are left out.
function toTiles(children: MassNode[], hue: string, unit: MassUnit): MassTile[];
function inUnit(kilograms: number, unit: MassUnit): number;
// To `precision` decimal places, as the document shows a mass.
function roundTo(value: number, precision: number): number;
// Each part below the level with no mass, once, but those in a library's assembly.
function missingParts(children: MassNode[]): MissingPart[];

interface MassLevel {
    /** The subassemblies opened to reach it, outermost first. */
    trail: MassAssembly[];
    children: MassNode[];
}

/** How the document shows a mass. */
interface MassDisplay {
    unit: MassUnit;
    /** Decimal places. */
    precision: number;
}

/** A treemap tile; its area is its share of the level's mass, in `unit`. */
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
    /** Every row's instances of it. */
    occurrences: string[][];
    /** The subassembly it's first found in, below the level; undefined at the level itself. */
    within?: string;
}
```

`src/frontend/features/mass-analysis/components/mass-treemap.tsx` and
`missing-mass-list.tsx` draw the two halves. The treemap is
`src/frontend/components/app-treemap.tsx`, which the dashboard's usage treemap
shares. A hovered row is lit up with `sendHighlightMessage`, and leaving the
list hands the window back with `showFocused` (`src/frontend/lib/messages.ts`).

`src/backend/features/analytics/tracking.ts`: `trackMassReport` (see
[analytics.md](./analytics.md)).

## Storage

None. The report lives in the client's query cache for the page's life, and is
read again on a refresh.

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
    - Columns are found by header name: Name, Quantity and Mass. Mass
      override is a column of its own and isn't read.
    - A subassembly's rows follow it one level deeper.
    - A subassembly is a library's when its document is one a library loads
      from, or it's inside one that is.
    - A part carries a key for its Part Studio, part and configuration, and the
      row's instances (`relatedOccurrences`).
4. Records `MASS_REPORT` in the background, and answers the tree.

### The page

1. The level opened starts at the assembly's own items.
2. The chart's caption is the level's total, in the document's mass unit and
   display precision (`useUnitInfo`), or kilograms until those load. Tiles are the level's
   items with any mass, heaviest first and darkest.
   A tile's tooltip gives its mass and its share of the level.
3. Clicking a subassembly's tile opens it, unless it is a library's. Clicking
   a part does nothing.
4. The breadcrumb lists each level above, back to the assembly.
5. The list below holds each part with no mass under the level, once, with the
   count the level holds, and under its name the subassembly it's first found
   in. Rows for the same part are merged by its key. Parts
   inside a library's assembly aren't listed.
6. Hovering a row lights up every instance of the part in Onshape, as whole
   instances. Leaving the list shows the window as it was.

## User-facing strings

[docs/strings/mass-analysis.md](../strings/mass-analysis.md).

## Invariants

- The feature only reads. It writes nothing to Onshape or to storage beyond
  its analytics event.
- Masses cross the API in kilograms. Only the page converts them, to the
  document's mass unit.
- Every mass in the report is Onshape's: the app never computes one from a
  material and a volume.
- A library's subassembly counts toward every total above it, but is never
  opened and its parts are never listed.
- Each report read records `MASS_REPORT`, after the read, in the background.

## Failure and recovery

- **The BOM's cells aren't in a shape `parseMass` reads**: the part shows as
  having no mass. The shapes are unverified (see
  [ONSHAPE.md](../ONSHAPE.md#bill-of-materials)); a fix goes in `bom.ts`
  alone.
- **A row's occurrences aren't in a shape `parseOccurrences` reads**: hovering
  it lights nothing up. The list still shows it.
- **The report goes stale** while someone edits the assembly in Onshape: the
  refresh button reads it again.

## Decisions

- **The BOM, not the assembly definition.** One call answers every part's mass
  at every level, already including mass overrides. The assembly
  definition has no masses, so it would cost a metadata call per Part Studio
  besides.
- **Excluded rows and subassembly BOM behavior are ignored.** A part left out
  of a team's BOM still weighs something.
- **A library's subassembly doesn't open.** Its parts are the library's to fix.
- **Read only.** A part's mass is fixed in Onshape, where the hover points.
  Setting it from the panel would rest on undocumented metadata calls, and a
  part in another document can only be changed in that document.
- **Instances come from the BOM's `relatedOccurrences`**, so lighting a part up
  costs no call beyond the BOM. The assembly definition names occurrences in a
  documented shape, but is Onshape's scarcest call.
- **The document's units, from `GET /api/unit-info`.** Its KV entry and the
  units webhook already keep a document's units; mass is one more field on
  them (see [configurations.md](./configurations.md)).
- **No server cache.** A cache keyed by the workspace would need a call to find
  its microversion, which saves nothing over reading the BOM again.
