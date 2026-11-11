# Downloads

## Purpose

Someone browsing the library downloads a part as a STEP file, in the
configuration on screen. Outside Onshape — the standalone app — it is the insert
menu's main action. Inside Onshape the part is inserted instead, and the
download is an item in the part's menu.

It is not an insert ([configurations.md](./configurations.md) covers how a
selection is sent to Onshape), though analytics counts both as uses of the part
([analytics.md](./analytics.md)). It keeps no file: every download is a fresh
export from Onshape.

## Code map

In the order a download runs.

`src/frontend/features/download/components/download-step-button.tsx`

```ts
// Standalone only; signed out, it starts sign-in instead.
function DownloadStepButton(props: DownloadStepButtonProps): ReactNode;

interface DownloadStepButtonProps extends DownloadArgs {
    insertable: InsertableOut;
    selection?: PartialSelection;
}
```

`src/frontend/features/download/components/download-step-menu-section.tsx`

```ts
// Inside Onshape only: the Download section of a part's menu.
function DownloadStepMenuSection(
    props: DownloadStepMenuSectionProps
): ReactNode;

interface DownloadStepMenuSectionProps extends DownloadArgs {
    insertable: InsertableOut;
    selection?: PartialSelection;
}
```

`src/frontend/features/download/queries.ts`

```ts
// Starts the export, polls it, then saves the file.
function useStepExportMutation(
    insertable: InsertableOut,
    selection: PartialSelection | undefined,
    downloadArgs: DownloadArgs
);

/** What a download records beside the part, as an insert does. */
interface DownloadArgs {
    isFavorite: boolean;
    source: UseSource;
}
```

`src/backend/features/download/routes.ts`

```text
POST /api/step-export/insertable/:insertableId    starts the export and records it; body { selection, isFavorite, source }
GET  /api/step-export/:translationId              its state
GET  /api/step-export/:translationId/file         the finished file, as an attachment
```

`src/backend/features/download/contract.ts`, a leaf module the frontend also
imports

```ts
function stepExportFilePath(translationId: string): string;

enum StepExportState {
    ACTIVE = "active",
    DONE = "done",
    FAILED = "failed"
}

interface StepExportOut {
    /** Onshape's translation id, which the status and file routes take. */
    translationId: string;
}

interface StepExportStatus {
    state: StepExportState;
}
```

`src/backend/lib/onshape/endpoints/translations.ts`

```ts
function startStepExport(
    client: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    options: { configuration: string; destinationName: string }
): Promise<OnshapeTranslation>;
function getTranslation(
    client: OnshapeApi,
    translationId: string
): Promise<OnshapeTranslation>;
// The finished export's bytes, unread, so they can be streamed on.
function downloadExternalData(
    client: OnshapeApi,
    documentId: string,
    externalDataId: string
): Promise<Response>;

enum OnshapeTranslationState {
    ACTIVE = "ACTIVE",
    DONE = "DONE",
    FAILED = "FAILED"
}

/** As much of `BTTranslationRequestInfo` as anything reads. */
interface OnshapeTranslation {
    id: string;
    requestState: OnshapeTranslationState;
    /** The document the translation ran against. */
    documentId: string;
    /** The tab it exported. */
    requestElementId?: string;
    /** Set once DONE; downloaded through {@link downloadExternalData}. */
    resultExternalDataIds?: string[];
    failureReason?: string;
}
```

`src/backend/features/library/insertables/read-selection.ts`, shared with the
insert routes

```ts
// Every request goes through here, so nothing past it holds a partial selection.
async function readSelection(
    db: Db,
    insertableId: string,
    requested: Selection | undefined
): Promise<{
    selection: Selection | undefined;
    parameters: ConfigurationParameter[];
}>;
```

## Storage

The file itself is not stored: Onshape keeps it as external data on the
library document, under the caller's translation, and the app holds only the
translation id, in the mutation, for as long as the download runs.

**D1**, through `trackDownload`: one `download` event per export started, and
its rollups ([analytics.md](./analytics.md)).

## Flows

### Downloading

1. Standalone (`useIsConnectedToOnshape` false), the insert menu's footer
   shows **Download STEP**. Inside Onshape, a part's menu — on its card, its
   recent, or the insert menu's ⋯ — has a **Download** section with the same
   item. Signed out, either reads **Sign in to download** and starts sign-in,
   which returns to the same url, so the menu reopens on the same
   configuration.
2. `POST /api/step-export/insertable/:insertableId` makes the selection whole
   (`readSelection`), and starts an Onshape translation of the version-pinned
   tab to STEP under the caller's session: its overrides
   (`onshapeOverrides`, then `encodeConfiguration`), one file for the whole tab
   (`grouping`), kept outside the document (`storeInDocument: false`). Once
   Onshape accepts it, the route records a download (`trackDownload`): the
   part, its whole selection, whether it is a favorite, and where the menu was
   opened from (`UseSource`), in the background as an insert is recorded.
3. The client polls `GET /api/step-export/:translationId`, first after a
   second and then backing off by half again up to five seconds, for at most
   five minutes.
4. Once it reads `done`, the client opens `/api/step-export/:translationId/file`
   through a link. The route streams Onshape's external data back as
   `model/step`, attached under the tab's name.

Both `GET` routes check that the translation belongs to a library document, by
its `documentId`, before answering.

### Why sign-in is needed

Onshape answers some reads of a public document with no credentials, but
refuses an unauthenticated translation ("Unauthenticated API request", 401).
So every export runs as a signed-in Onshape user, and Onshape decides whether
that user may export the document. Every Onshape user may view and copy a
public document; that this includes exporting it is not documented, and is
unverified until a non-member downloads one. The library documents' sharing is
checked by the `NOT_PUBLIC` build issue ([build-issues.md](./build-issues.md)).

## User-facing strings

In [strings/download.md](../strings/download.md).

## Invariants

- The download is the insert menu's footer button only outside Onshape;
  inside, the footer inserts, and the download is a menu item.
- An export runs under the caller's own session, never a background one, so
  Onshape's permissions on the document are the caller's.
- The export is of the version-pinned tab, at the whole selection's overrides,
  as an insert would send them; never a configuration key.
- The status and file routes answer only for a translation of a library
  document.
- The file is never stored: a second download is a second export.
- Every export Onshape accepts records exactly one download, which counts as a
  use beside the inserts; a refused export records nothing.

## Failure and recovery

| What goes wrong                        | Shows as                                                        | Put right by                          |
| -------------------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| Signed out                             | **Sign in to download**                                         | Signing in                            |
| The session lapsed                     | Error toast with **Sign in**                                    | Signing in                            |
| The caller may not export the document | Onshape's 403, as the usual forbidden toast                     | The library making it public          |
| Onshape fails the translation          | "Onshape couldn't export {name}." The reason is logged          | Trying again; a report if it persists |
| The export outlasts five minutes       | "Onshape is taking too long to export {name}. Try again later." | Trying again                          |
| Rate limited                           | The usual rate-limit toast                                      | Waiting                               |

## Decisions

- **Signed in, as the caller.** An export under the owner's or an admin's
  session would let anyone download without an Onshape account, but would spend
  that account's API allocation on every anonymous visitor and bypass Onshape's
  own permission check. Asking the caller to sign in keeps every call theirs.
- **Polled from the client, not the Worker.** An export takes seconds to
  minutes; one short request per poll keeps each Worker request brief and lets
  the button show progress.
- **Streamed through the Worker.** Onshape's external data needs the caller's
  token, which never leaves KV, so the browser can't fetch it directly.
- **A menu item inside Onshape.** Inserting is what the panel is for, so the
  footer keeps to it; a STEP file is still wanted there, for a simulator or a
  supplier, and the part's menu is where the other secondary actions are.
- **No cache.** Exports are per caller, and caching one in R2 would serve it
  without Onshape's permission check. A shared cache is the step to take if
  anonymous downloads are wanted.

_Last reviewed: 2026-11-11_
