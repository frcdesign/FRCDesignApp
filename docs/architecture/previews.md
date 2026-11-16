# Previews and the Companion

## Purpose

Showing parts in Onshape's graphics window before they're inserted. Today
that's Auto Assembly: every screw, washer and nut a run would insert, where it
would go, as the picks are checked.

There are three pieces:

- **The app** makes each part's mesh from Onshape's tessellation and stores it.
- **The panel** fetches the meshes and posts them to the Onshape page.
- **The FRCDesignApp Companion** draws them in Onshape's view.

The Companion is a Chrome extension, `src/extension/`, that gives the app
more to work with inside Onshape. Previews are all it does today. It draws only
what the panel sends; it calls no API and fetches nothing. Without it, nothing
is previewed and nothing else changes. The panel offers it in the navbar and
after an insert.

Onshape has no API for drawing in its view. The Companion reaches into
Onshape's web client, so every release of Onshape can break it; see
[The web client's viewer](../ONSHAPE.md#the-web-clients-viewer).

## Code map

`src/frontend/features/companion/connection.ts`,
`src/frontend/features/companion/components/companion-button.tsx` and
`src/frontend/features/companion/companion-tip.ts`

```ts
// Asks the Onshape page for the Companion once a launch names it; from the app shell.
function useCompanionHandshake(): void;
const useCompanion: UseBoundStore<StoreApi<CompanionState>>;
// Inside Onshape, in a browser that can install it.
function useCanUseCompanion(): boolean;
function postToCompanion(server: string, request: CompanionRequest): void;
// Beside the theme toggle: gets the Companion, or says it's connected.
function CompanionButton(): ReactNode;
// After an insert, until the Companion has connected on any computer.
function useCompanionTip(): () => void;

interface CompanionState {
    /** Whether it answered, in this protocol's version. */
    isConnected: boolean;
}
```

`src/backend/features/companion/contract.ts`, shared by the frontend and the
Companion

```ts
function parseCompanionRequest(data: unknown): CompanionRequest | undefined;
function parseCompanionReady(data: unknown): CompanionReady | undefined;
const APP_ORIGINS: string[];

/** What the panel posts to the Onshape page it's in. */
type CompanionRequest =
    | { source: typeof COMPANION_SOURCE; type: "hello" }
    | {
          source: typeof COMPANION_SOURCE;
          type: "show-preview";
          /** Each mesh the parts name, as the app serves it, by id. */
          meshes: Record<string, ArrayBuffer>;
          parts: PreviewInstance[];
      }
    | { source: typeof COMPANION_SOURCE; type: "clear-preview" };

/** The Companion's answer to `hello`. */
interface CompanionReady {
    source: typeof COMPANION_SOURCE;
    type: "ready";
    version: number;
}
```

`src/backend/features/auto-assembly/routes.ts` and `insert.ts`

```text
POST /api/auto-assembly/check    answers `previews` with the plans
```

```ts
// Each part as the Companion draws it, from its studio's loaded version.
function previewParts(set: FastenerSet, parts: PartPlacement[]): PreviewPart[];
```

`src/frontend/features/preview/queries.ts` and `src/frontend/lib/messages.ts`

```ts
// Previews `parts` while they're set; clears when they aren't or the caller unmounts.
function usePartPreview(
    parts: PreviewPart[] | undefined,
    isUpdating?: boolean
): void;
// Onshape's spinner for work going on in its tab.
function sendWorkingSpinnerMessage(
    elementPath: ElementPath,
    isWorking: boolean
): void;
```

`src/backend/features/previews/routes.ts`, `tessellate.ts` and `store.ts`

```text
GET /api/preview-mesh/insertable/:insertableId?microversionId=&configuration=&v=
```

```ts
// Two calls to Onshape, under the caller's session.
async function tessellate(
    client: OnshapeApi,
    path: ElementPath,
    configuration: Selection
): Promise<PreviewMesh>;
function toPreviewMesh(faces: unknown, edges: unknown): PreviewMesh;
function previewKey(
    elementId: string,
    microversionId: string,
    configurationKey: ConfigurationKey
): string;
```

`src/backend/features/previews/contract.ts`, shared by the backend, the
frontend and the Companion

```ts
function previewMeshId(part: PreviewPart): string;
function encodePreviewMesh(mesh: PreviewMesh): ArrayBuffer;
function decodePreviewMesh(buffer: ArrayBuffer): PreviewMesh | undefined;

/** Where one part of a preview goes, and the mesh it is drawn with. */
interface PreviewPart {
    insertableId: string;
    /** The insertable's version the mesh is made from; pins the mesh's url. */
    microversionId: string;
    /** The selection's values, as `encodeConfiguration` writes them. */
    configuration: string;
    /** Into the open element, as Onshape writes a transform: 16 numbers, row-major, metres. */
    transform: number[];
}

/** A part's surface and its edges, in its Part Studio's coordinates, in metres. */
interface PreviewMesh {
    positions: Float32Array;
    normals: Float32Array;
    /** Triangles, three indices each. */
    indices: Uint32Array;
    /** Edge segments, two points each, xyz. */
    edges: Float32Array;
}

/** A part to draw: a mesh the same message carries, placed by a transform. */
interface PreviewInstance {
    mesh: string;
    /** Row-major, metres, as `PreviewPart.transform`. */
    transform: number[];
}
```

`src/extension/main.ts`, `preview.ts`, `ghost-renderer.ts` and
`onshape-viewer.ts`

```ts
// In-scene when it can be, over the view otherwise.
class PreviewController {
    show(meshes: Record<string, ArrayBuffer>, parts: PreviewInstance[]): void;
    clear(): void;
    readonly mode: PreviewMode;
}
class GhostRenderer {
    setScene(meshes: Map<string, PreviewMesh>, instances: Instance[]): void;
    drawInScene(camera: Camera): void;
    drawOverlay(camera: Camera): void;
}
function findViewer(): OnshapeViewer | undefined;
function readCamera(viewer: OnshapeViewer): Camera | undefined;
function findDepthClearPass(viewer: OnshapeViewer): DrawPass | undefined;

type PreviewMode = "scene" | "overlay" | "none";

interface Instance {
    mesh: string;
    /** Column-major, as WebGL takes it. */
    model: Float32Array;
}

interface Camera {
    /** Column-major, as WebGL takes them. */
    viewMatrix: Float32Array;
    projectionMatrix: Float32Array;
}
```

`vite.extension.config.ts` builds the Companion (`npm run build:extension`)
into `dist-extension/`, with its manifest from `src/extension/public/`.
`COMPANION_URL` in `src/frontend/lib/url.tsx` is where the app sends someone to
get it.

## Storage

- **R2** `previews/{elementId}/{microversionId}/{configuration}` — one mesh,
  in `encodePreviewMesh`'s format. The configuration is the selection's
  `ConfigurationKey`, url-encoded, or `default`. A key names an element's
  version, so a stored mesh is never stale. Deleted with its element's
  thumbnails once a load orphans them, and with configuration renders on a
  forced reload (`deleteStaleThumbnails`, see [thumbnails.md](./thumbnails.md)).
- **KV** `seen-hints:` — `Hint.CONNECTED_COMPANION`, once the Companion has
  answered; see [auth.md](./auth.md).
- **localStorage** (`ui-state`): `companionTipCount`.
- **Memory** — each mesh the panel fetched, in the query cache for the page's
  life, and the Companion's GPU copies while they're shown.

## Flows

### Finding the Companion

1. The Companion's script runs in the Onshape page itself (the manifest's
   `"world": "MAIN"`), at `document_start`, so it listens before any panel
   loads.
2. Once the launch names Onshape's server, the app shell posts `hello` to the
   page (`useCompanionHandshake`).
3. The Companion answers `ready` with its protocol version to a `hello` from
   one of `APP_ORIGINS`. A matching version sets `isConnected`, and records
   `Hint.CONNECTED_COMPANION` against the user.

### Offering the Companion

Both offers show only inside Onshape, in a browser that can install a Chrome
extension (`useCanUseCompanion`: Chrome, Edge or Opera).

- **The navbar** has a puzzle piece beside the theme toggle
  (`CompanionButton`), badged with its status (`BadgedIcon`). Without the
  Companion, it carries the info badge, its tooltip says to get it, and a
  click opens `COMPANION_URL`. Connected, it carries the check, and its tooltip
  says so.
- **After an insert** — a library insert, or starting an Auto Assembly run —
  a tip toast offers it, with a button opening `COMPANION_URL`
  (`useCompanionTip`). It shows at most once a page load and three times in
  all, and never once the Companion has connected on any computer.

### Previewing Auto Assembly

1. The pick check plans each hole as a run would (see
   [auto-assembly.md](./auto-assembly.md#checking-picks--post-apiauto-assemblycheck)).
   With options, it also answers `previews`: `placements` for the ready holes,
   each as its studio's insertable, loaded version, configuration and
   transform (`previewParts`).
2. While anything is picked, the panel passes the last check's previews to
   `usePartPreview`. Nothing picked passes none.
3. With the Companion connected, it fetches each distinct mesh once
   (`previewMeshId`), then posts `show-preview` with the meshes and each part's
   transform. A mesh that failed is left out, with its parts.
4. Onshape's working spinner turns while a planned check is going or meshes
   are coming (`sendWorkingSpinnerMessage`), and stops when they're done or
   the page is left.
5. No parts posts `clear-preview`, and so does leaving the page.

### Making a mesh — `GET /api/preview-mesh/insertable/:insertableId`

1. Signed in only, since a miss calls Onshape as the caller.
2. Reads the insertable's current version and parameters. A `microversionId`
   other than the current one answers 404.
3. Settles the configuration as the insert menu does (`toSelection`,
   `normalizeSelection`) and keys it (`toKey`).
4. Serves the stored mesh. On a miss, it asks Onshape for the configuration's
   tessellated faces and edges at once (`renderOverrides`), and makes a mesh
   (`toPreviewMesh`): vertices with the same position and normal merged, and
   each edge's polyline cut into segments.
5. A mesh with no triangles answers 404 and isn't stored. Any other is
   stored, then served, cached as immutable for the caller.

### Drawing

1. `show-preview` decodes each mesh and turns each transform column-major.
   The renderer uploads each mesh once, and draws one instance per part, in
   green: apart from the blue Onshape selects in.
2. **In the scene.** `findViewer` takes the viewer from Onshape's Angular
   injector. `findDepthClearPass` finds the pass that clears depth before
   what Onshape draws on top of the model, and its `draw` is wrapped. Before
   it runs, the preview is drawn in Onshape's own frame, against the model's
   depth:
    - Where the model hides it, faint faces and edges.
    - Where it doesn't, its nearest surface lit and translucent, and its edges
      solid.

    Every piece of WebGL state it changes is put back after. It draws only
    into the screen's framebuffer, so never into a pick or print.

3. **Over the view.** If the viewer, the camera, Onshape's context or the pass
   can't be found, it draws on its own canvas over the view instead, without
   the model hiding anything. So does a draw that throws, or Onshape drawing
   no frame with the preview in 1.5 seconds. After three failures in-scene
   drawing stays off until the page reloads.
4. Every 400 ms it checks the viewer, pass and wrapped `draw` are still the
   ones it found, since Onshape swaps them as tabs change, and draws again
   where it should.
5. `clear-preview` puts the pass's `draw` back, frees the GPU copies and
   removes the overlay. `frcDesignCompanion` in the page's console clears it
   (`clearPreview`), and says how it's drawn (`previewMode`).

## User-facing strings

In [strings/previews.md](../strings/previews.md).

## Invariants

- The Companion draws only what a message from `APP_ORIGINS` sent it, and
  answers only those origins.
- The panel sends the Companion nothing but `hello` until it has answered in
  this protocol's version.
- A mesh is keyed by its element's version and the selection's configuration
  key, so every selection drawing the same part shares one, and it is never
  stale.
- A mesh is made under the caller's session, never stored empty, and never
  sent to Onshape.
- Drawing in Onshape's frame leaves every piece of WebGL state as it found it,
  and draws only into the screen.
- Every spinner the panel starts in Onshape, it stops.
- Without the Companion, or when it fails, the app works as it does without
  previews.

## Failure and recovery

| Failure                                        | Result                                        | Recovery                         |
| ---------------------------------------------- | --------------------------------------------- | -------------------------------- |
| The Companion isn't installed                  | No preview; nothing is fetched                | Install it                       |
| Onshape renames what the Companion reaches     | Drawn over the view, or not at all            | Update `onshape-viewer.ts`       |
| Onshape refuses the tessellation, or times out | That mesh is left out; its parts aren't drawn | The next check asks again        |
| Onshape answers a shape the parser can't read  | 404, nothing stored                           | Fix `toPreviewMesh`              |
| The library loads a new version mid-check      | 404 for the old url                           | The next check names the new one |

## Decisions

- **Meshes from Onshape, not drawn by hand.** A preview should look like the
  part that will be inserted. Onshape's tessellation of the configuration is
  that part, edges included, and costs two calls the first time anyone asks for
  a configuration.
- **The panel fetches and posts.** The panel has the session and the query
  cache, so the mesh route stays behind sign-in. A Companion fetching from the
  app would need a public route that calls Onshape on a miss, and CORS.
  Structured clone copies a few hundred kilobytes in a message.
- **One mesh per configuration, keyed as thumbnails are.** A mesh is a render
  of a selection, so it is named by its `ConfigurationKey`. Finishes are in the
  key, so two finishes of one screw are two meshes; they're small.
- **Inside Onshape's frame, with an overlay to fall back to.** Drawing just
  before the depth-only clear is when the model's depth is there to hide the
  preview against. The overlay keeps something on screen when Onshape changes.
- **Hidden parts show faintly.** A nut under a plate is still worth seeing,
  as Onshape shows what a feature makes behind other parts.
- **A Companion, not a preview extension.** The extension is named for what it
  is to the app, so what it does next joins it, and one install covers all of
  it.
- **Offered where it helps, then quiet.** The navbar's button stays, since it
  also says whether the Companion is connected, as a status badge like the
  app's others. The tip comes after an insert,
  when previews would have helped, and stops once it's connected anywhere or
  after three.

_Last reviewed: 2026-11-16_
