# FRCDesignApp — System Reference

This document explains what FRCDesignApp is, how its pieces fit together, and where to find things in the codebase. If you want step-by-step recipes for adding new features, see [GUIDE.md](./GUIDE.md).

## What Is This App?

FRCDesignApp is a part-library browser that runs **inside Onshape** as an embedded tab (technically an iframe). When a user opens an Onshape part studio or assembly document, they can open this app in a side panel, browse a curated library of FRC robot parts organized into groups, and click a part to insert it into an assembly or derive it into their part studio.

The app reflects underlying Onshape documents that are owned and maintained by the FRCDesignLib team. Parts reflect the underlying Onshape documents — for example, part names come from the names of the underlying tabs, and configurations reflect the settings defined in Onshape.

The app is hosted on Cloudflare. The frontend is served by Cloudflare as a Single Page Application (SPA) to the user's browser, meaning the frontend code loads and executes directly in the user's browser. The backend runs on Cloudflare, exposes endpoints for the frontend to call, and handles access to resources like the database and Onshape. For security, all communication with the Onshape API is routed through the backend.

-------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Frontend UI | React 19 + [Mantine](https://mantine.dev/) | React for component model; Mantine for a rich set of pre-built accessible UI components (modals, menus, notifications, etc.) |
| Frontend routing | [TanStack Router](https://tanstack.com/router) | File-based routing: each `.tsx` file under `src/frontend/routes/` automatically becomes a URL route. Type-safe navigation. |
| Server-state caching | [TanStack Query (React Query)](https://tanstack.com/query) | Handles fetching, caching, and revalidating data from the backend. Prevents redundant network requests and keeps the UI in sync. |
| Backend framework | [Hono](https://hono.dev/) | A lightweight HTTP framework (similar to Express, but designed for edge runtimes like Cloudflare Workers). |
| Database ORM | [Drizzle ORM](https://orm.drizzle.team/) | Type-safe SQL query builder. Schema is defined in TypeScript and migrations are generated automatically. |
| Build tool | [Vite](https://vite.dev/) + `@cloudflare/vite-plugin` | Bundles both the React SPA and the Cloudflare Worker in one build step. |
| Validation | [Zod](https://zod.dev/) | Runtime schema validation, used for API responses, URL params, and localStorage state. |
| Testing | [Vitest](https://vitest.dev/) + `@cloudflare/vitest-pool-workers` | Runs tests inside a Workers runtime so tests accurately reflect the production environment. |

## Cloudflare Services

The app uses five Cloudflare products. Each one is declared as a **binding** in `wrangler.jsonc` and accessed in Worker code via `c.env.<BINDING_NAME>`.

### D1 — The Database (`c.env.DB`)

D1 is Cloudflare's managed SQLite database. It is the app's primary persistent store — everything about libraries, groups, parts, users, and favorites lives here.

Queries go through **Drizzle ORM** so you write TypeScript instead of raw SQL. The schema is defined in `src/backend/db/schema.ts`. SQL migration files live in `drizzle/` and are applied automatically on deploy.

### KV — Session & Token Storage (`c.env.KV`)

KV is a key-value store (like a global dictionary). The app uses it exclusively for **authentication**:

- During the OAuth login flow, it briefly stores the OAuth `state` and the URL to redirect back to after login.
- After login succeeds, it stores the user's access token and refresh token, keyed to their session cookie.

KV serves as a cheap, lightweight way to persist user data across multiple Cloudflare Workers (which Cloudflare automatically scales and provisions based on the app's current traffic). Because Workers are stateless — there is no in-memory session that persists between requests — KV is the right place to stash tokens between requests.

### R2 — Blob Storage (`c.env.BLOB`)

R2 is Cloudflare's blob storage, optimized for unstructured data like images and PDFs. One bucket holds everything the app stores as a blob, kept apart by key prefix:

| Prefix          | What it holds                                                             | Lifetime                                          |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| `thumbnails/`   | Rendered thumbnails, by element and configuration                         | Kept until reconciled; see below                  |
| `search-index/` | Each library's serialized MiniSearch index, under a version for its shape | Rewritten on every index rebuild; built on a miss |

Onshape can generate preview thumbnails for parts and assemblies, but fetching them from Onshape on every page load would be slow and eat into API rate limits — a single render can require polling and take minutes. Instead, every thumbnail we ever fetch from Onshape lands in R2 and is served from there afterwards.

Every thumbnail is read from the document's **thumbnail workspace** (`FRCDesignApp Thumbnails (DO NOT EDIT)`; `features/thumbnails/workspace.ts`), not from the version itself — Onshape sometimes never renders an element's thumbnail in a version — and not from the document's own workspace, which moves on from that version. Each document has one. A load makes it off the version the first time, and afterwards restores each new version into it, which adds a microversion rather than a branch to the document's history. The group row records the workspace beside its version, which is how a forced reload of the same version skips the restore. Any other workspace of ours is deleted once the group has moved on. Restored content has no thumbnails for a few minutes, so a load's thumbnail steps retry for about 17 minutes, under a limiter of their own so the wait never holds up probing.

Thumbnails are keyed by whether they are the element's default or a specific configuration:

```
thumbnails/default/{elementId}/{microversionId}/{size}
thumbnails/config/{elementId}/{microversionId}/{configKey}/{size}
```

`{configKey}` is the url-encoded `ConfigurationKey` — the canonical configuration with hidden and default-valued parameters dropped and quantities in meters and radians — so two equivalent selections resolve to one cached image. Encoding it keeps its `;` and `=` inside a single path segment. Including `{microversionId}` makes every object immutable, so an updated document lands on new keys rather than overwriting in place.

Nothing expires on a timer: there is no R2 lifecycle rule, and renders are meant to last. What that costs is orphans — a tab edited into a new microversion leaves its old pair behind, and a deleted group or tab leaves everything it had. A **daily cron** (the `scheduled` handler in `src/backend/index.ts`) collects them, in `features/thumbnails/reconcile.ts`:

- The live set is every `(elementId, microversionId)` still named by an insertable row, plus the ones a group's two stored thumbnail urls point at — a group's document thumbnail is often not one of its own insertables, and those urls are the only record of which element it is.
- It spans **every library**, because a thumbnail key names no library. A set built from one library would read every other library's thumbnails as orphaned.
- Both prefixes are reconciled the same way: a configuration render is addressed by the same element and microversion, so it lives and dies with the element's default.
- An object younger than 24 hours is kept whatever the live set says. A group load stores thumbnails as it goes and commits its rows at the end, and a configuration render is started by a user opening the insert menu rather than by any job — so something in flight is indistinguishable from something orphaned, and only age tells them apart.
- An empty live set deletes nothing: a library really can have no elements, but so can a read that failed.
- A run scans at most 50 pages of 1,000. A bucket larger than that is finished by the next run.

Thumbnails are served via `/api/thumbnail/:size/:elementId?v={microversionId}&configurationKey=&insertableId=`:

- **Hit** — streamed from R2 as immutable, cacheable for a year.
- **Miss** — 404, uncached, so a render landing later is not shadowed. A configuration miss is never answered with the element's default: that would show a part the caller did not ask for. The client shows the default itself while it waits.
- **Miss with `insertableId`**, from a signed-in caller — the route also starts a `RenderThumbnailWorkflow` for the configuration (`features/thumbnails/render.ts`). The insert menu and favorite rows ask for this; search rows do not, so one cold search cannot start a render per row.
    - The route resolves Onshape's thumbnail id for the configuration, one Onshape call per miss. Onshape having no part for the configuration answers 422 at once, which the client shows as a configuration that failed to regenerate.
    - The instance id is built from that thumbnail id, so every miss for one render finds the same instance and starts nothing new.
    - The workflow is handed that id and both R2 keys, and asks Onshape for both sizes at once until they land (404 means still rendering), for about a minute.
    - A finished instance found on a miss left no bytes behind, so it is restarted.

### Workflows — Background Jobs

Cloudflare Workflows let you run a long-running background job that survives beyond a single HTTP request's time limit. The load workflow lives in `src/backend/features/load/workflows.ts`; the thumbnail one lives with the feature it serves, in `src/backend/features/thumbnails/render-workflow.ts`:

| Binding                     | Class                     | What it does                                                                  |
| --------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `LOAD_DOCUMENT_WORKFLOW`    | `LoadDocumentWorkflow`    | Loads one group's document when its version moved on (or always, when forced) |
| `RENDER_THUMBNAIL_WORKFLOW` | `RenderThumbnailWorkflow` | Waits out one configuration's render and stores both sizes in R2              |

Loading a group means walking the document structure, downloading metadata for every part and assembly, probing each indexed configuration, generating thumbnails, and writing it all to D1 — far too long for a single HTTP request. The request kicks the workflow off and returns immediately.

Every load is one document: adding a document, a new version of one (see Webhooks below), and the owner's "reload everything", which starts one per group. `features/load/jobs.ts` keeps at most one load per group running, in the `load_jobs` table: a load asked for while one runs is marked on that row, and the running load starts it as it finishes. Each load that wrote to its group rebuilds its library's search index and bumps its version, so every load stands alone and "reload everything" simply starts them all at once.

Each workflow carries a `sessionId` whose tokens it calls Onshape under after the request has ended: the requesting user's, or the owner's for a webhook.

### Webhooks and live updates

Onshape pushes two things, registered with `isTransient: false` and recorded in the `onshape_webhooks` table, each with its own token in the delivery url (`features/webhooks`):

- **A new version of a library document.** Registered by the document's load; removed with the last group loaded from it. Reloads that document's groups.
- **A change to an admin team's members.** Registered when the owner sets a library's admin team. Pulls the team's members again.

The server pushes to open clients over a WebSocket held by the `LiveUpdates` Durable Object (`features/live`): jobs starting and finishing, a library's new version, and a configuration's render landing. Nothing polls: a client that reconnects asks again for what it may have missed.

### Assets — Static File Serving (`c.env.ASSETS`)

The compiled React app (HTML, JS, CSS) is served directly by Cloudflare's asset infrastructure. The Worker only intercepts three path patterns: `/init`, `/api/*`, and `/auth/*`. Everything else (the SPA files, icons, fonts) is served from the static asset bundle without going through Worker code.

The asset binding is configured with `single-page-application` mode, which means any unrecognized path serves `index.html` — necessary for client-side routing to work.

## How Users Get Into the App

The server decides where a caller lands before the app loads. The client has one redirect of its own: `/` resumes the last tab and group from `localStorage`.

### From Onshape (`/init`)

Onshape opens the panel at `/init?documentId=…&instanceType=…&elementId=…&elementType=…&server=…&sessionCompanyId=…` (`features/entry/routes.ts`).

1. A version or microversion is sent to `/version-error`: there is nothing to insert into.
2. If Onshape won't take the caller's session, `/init` sends them through sign-in and back to itself, marked with `signInAttempted` so it never bounces twice.
3. Otherwise it redirects into the app: to the tab and group the caller's row last recorded, with Onshape's parameters kept and their saved `theme` and `tabId` added.

The `/app` route reads all of that off the url once per page load, into `ui-state` (`routes/app/route.tsx`). From then on the store is what the app reads, and in-app navigation keeps only the app's own parameters (`q`, `part`, `config`, `favorite`) in the url.

### Signing in

`/auth/sign-in?redirectUrl=<local path>&sessionCompanyId=…` stores `{ state, redirectUrl }` under a login cookie and sends the caller to Onshape's authorize page. An absent or offsite `redirectUrl` becomes `/`. Onshape returns to the OAuth app's registered callback, `/auth/callback`, which checks `state`, exchanges the code for tokens (via [Arctic](https://arcticjs.dev/)), starts a session, and redirects to the stored path.

`/init` passes itself as the path. The app's own sign-in button passes the page it is on, so a caller comes back where they were.

## Storage at a Glance

| Store              | What it holds                                                                          | Lifetime                                                          | Who reads/writes it                                                                           |
| ------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **D1**             | Library data, groups, parts (insertables), configurations, user preferences, favorites | Permanent (until explicitly changed)                              | Backend Worker on every API request                                                           |
| **KV**             | OAuth session state (during login) and auth tokens (after login)                       | Login state: 10 minutes. Tokens: 30 days.                         | Backend Worker in `src/backend/features/auth/session.ts`                                      |
| **R2**             | Thumbnail images and per-library search indexes                                        | Defaults and indexes permanent; configuration thumbnails ~90 days | Backend Worker in `src/backend/features/thumbnails/` and `src/backend/features/library/db.ts` |
| **localStorage**   | UI state: open/closed panels, active search query, vendor filters, last-opened group   | Persists across browser sessions                                  | Frontend only, via `src/frontend/lib/ui-state.ts`                                             |
| **sessionStorage** | Not used                                                                               | —                                                                 | —                                                                                             |

## Codebase Map

The source lives in two directories under `src/`: `backend/` (the Cloudflare
Worker) and `frontend/` (the React SPA). There is no shared directory — the
backend owns the contract, and the frontend imports it through `@backend/*`.

Both sides use the same shape: `features/<feature>/` for everything one feature
owns, `lib/` for cross-cutting plumbing, and a small set of files at the root.

### `src/backend/`

- `index.ts` — Worker entry point; exports the default app and the three Workflow classes
- `app.ts` — composition root, and nothing else: binds the caller onto each request, mounts every feature's routes, and installs the error handler
- `db/` — `client.ts` (the Drizzle client) and `schema.ts` (table definitions)
- `lib/` — request plumbing shared by every feature: `context.ts` (bindings, typed context, and the caller binding), `cache.ts` (cache-control middleware), `api-error.ts` and `errors.ts` (the one shape every failed response takes), `validate.ts`, `route-params.ts`, `query-params.ts`
- `lib/onshape/` — everything that talks to Onshape's REST API: `client.ts` (the client class), `api-path.ts`, `path.ts` (`ElementPath`/`InstancePath` and their serializers), `endpoints/` (per-category wrappers), `objects/` (feature and query builders)
- `features/` — one directory per feature, each holding its own `routes.ts` plus whatever it owns:
    - `auth/` — split by role: `session.ts` stores the session cookie and its KV records, `onshape-oauth.ts` runs the handshake, `caller.ts` resolves who is calling (and exports `productionCaller`, the wiring `createApp` binds), `guards.ts` holds both gates, and `routes.ts` serves the OAuth redirects plus `/access-data`
    - `entry/` — `/init`, where Onshape lands: gates on auth, then resumes the caller in the library and theme they last used
    - `settings/` — the caller's stored preferences and the `Settings` model
    - `library/` — the library response (`db.ts`), its DTOs, and the groups and insertables endpoints
    - `load/` — everything that turns Onshape into what we store: the `parse-*` modules (document contents, configurations, configuration records, vendors, fasten info), the per-group and per-insertable loaders, the Workflows that drive them, their retry policies, and the job tracker
    - `configurations/` — the configuration domain the frontend shares: models, canonicalization, combination enumeration, and the input parser

    An element's own part number and material live on `insertables.part_data`; a `configurations` row exists exactly when the element has parameters to configure.
    - `thumbnails/` — rendering and R2 storage (`store.ts`), its Workflow, the routes, and the key and URL scheme the client shares
    - `build-checker/` — build issues, the checks that raise them, and the build-status endpoint
    - `favorites/`, `search/`

### `src/frontend/`

- `main.tsx` — React root; wraps the app in `QueryClientProvider` and `MantineProvider`
- `routes/` — file-based TanStack Router routes
- `lib/` — cross-cutting helpers: `api-client.ts` (fetch wrappers), `query-keys.ts` (every query key in one place), `query-client.ts`, `ui-state.ts` (localStorage state), `refresh.ts`, `notifications.tsx`
- `components/` — UI used by more than one feature, plus the app shell (`app-navbar.tsx`, `alerts.tsx`, `root-error.tsx`)
- `features/` — `library/`, `favorites/`, `insert/`, `search/`, `settings/`, `thumbnails/`, `build-status/`, `auth/`, each with a `queries.ts` and a `components/` directory

Other top-level files:

- `drizzle/` — SQL migration files generated by Drizzle Kit
- `wrangler.jsonc` — Cloudflare Workers config (bindings, routes, env vars)

## Access Levels

The app has four access levels, checked on every protected API call: **OWNER**, **ADMIN**, **EDITOR**, and **USER**. Access is per library. Admin and editor access currently grant the same permissions in their library (adding, removing, and renaming groups, toggling insertable visibility), but they are kept separate so permissions can be tightened in the future if needed. USER access allows anyone who logs in via OAuth to browse the library, insert parts, and manage their own favorites.

The **owner** is the one Onshape user named by `OWNER_USER_ID`, with every library. The owner sets each library's admin team; its members are stored in `admin_team_members` (team admins as ADMIN, members as EDITOR) and kept current by the team's webhook, so a user's access is a database lookup in `src/backend/features/auth/request-auth.ts`. Routes that require elevated access are wrapped with `requireEditor` or `requireOwnerMiddleware` from `src/backend/features/auth/guards.ts`; one naming an insertable rather than a library looks the library up from it. The owner's latest session is also what webhook-triggered loads run under.

During local development, you can bypass the team membership check by setting `ACCESS_LEVEL_OVERRIDE=admin` (or `editor`/`user`) in your `.env` file.
