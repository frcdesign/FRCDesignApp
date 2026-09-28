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

### KV — Sessions and Caches (`c.env.KV`)

KV holds what may expire or be lost. Every key belongs to a `kvStore` (`src/backend/lib/kv-store.ts`) with its own prefix, value type and lifetime:

- `session:` — a signed-in session's access and refresh tokens and user id, keyed by the opaque id in the `frc-design-app-session` cookie, for 30 days (`features/auth/session.ts`). A sign-in in flight keeps nothing here: its state and return path are the whole of the ten-minute `frc-design-app-login` cookie (`features/auth/login.ts`).
- `background-session:` — the latest session ids of the owner and each admin team member, so a load nobody is signed in behind can run as one of them.
- `unit-info:` — a workspace's units, for a week. On a miss the route asks Onshape and registers a transient `updateworkspaceunits` webhook, whose delivery drops the entry. Onshape cleans transient webhooks up after a while without events, so nothing records or removes them, and the expiry covers one it drops quietly. Onshape doesn't sign webhooks registered through the API, so the url names the workspace plainly: a forged delivery only costs a refetch (`features/webhooks/transient.ts`).

### R2 — Blob Storage (`c.env.BLOB`)

R2 is Cloudflare's blob storage. One bucket holds everything the app stores as a blob, kept apart by key prefix:

| Prefix          | What it holds                                                             | Lifetime                                          |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| `thumbnails/`   | Rendered thumbnails, by element, microversion and configuration           | Deleted by the load that orphans them             |
| `search-index/` | Each library's serialized MiniSearch index, under a version for its shape | Rewritten on every index rebuild; built on a miss |

Every thumbnail the app shows is served from R2, never fetched from Onshape per view. How they are rendered, keyed, served and cleaned up is in [architecture/thumbnails.md](./architecture/thumbnails.md).

### Workflows — Background Jobs

Cloudflare Workflows run long background jobs that survive past a request and resume after a failure:

| Binding                     | Class                     | What it does                                                                  |
| --------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `LOAD_DOCUMENT_WORKFLOW`    | `LoadDocumentWorkflow`    | Loads one group's document when its version moved on (or always, when forced) |
| `RENDER_THUMBNAIL_WORKFLOW` | `RenderThumbnailWorkflow` | Waits out one configuration's render and stores both sizes in R2              |
| `VERSION_MANAGER_WORKFLOW`  | `VersionManagerWorkflow`  | Runs one push or pull between linked workspaces                               |

Loads, their job tracking, webhooks and version approval are in [architecture/loading.md](./architecture/loading.md); renders in [architecture/thumbnails.md](./architecture/thumbnails.md).

### Pushes

The server pushes to open clients over a WebSocket held by the `PushHub` Durable Object (`src/backend/features/push/`): jobs starting and finishing, a library's new version, and a configuration's render landing. Nothing polls: a client that reconnects asks again for what it may have missed.

### Assets — Static File Serving (`c.env.ASSETS`)

The compiled React app (HTML, JS, CSS) is served directly by Cloudflare's asset infrastructure. The Worker only intercepts three path patterns: `/init`, `/api/*`, and `/auth/*`. Everything else (the SPA files, icons, fonts) is served from the static asset bundle without going through Worker code.

The asset binding is configured with `single-page-application` mode, which means any unrecognized path serves `index.html` — necessary for client-side routing to work.

## How Users Get Into the App

Onshape opens the app at `/init`, which sends a caller without a working session through Onshape sign-in and back, then hands off to the SPA at `/`. `/` resumes the last tab and group from `localStorage`. The sign-in flow, sessions and access are in [architecture/auth.md](./architecture/auth.md).

The `/app` route reads Onshape's parameters off the url once per page load, into `ui-state` (`src/frontend/routes/app/route.tsx`). From then on the store is what the app reads, and in-app navigation keeps only the app's own parameters (`q`, `part`, `config`, `favorite`) in the url.

## Storage at a Glance

| Store              | What it holds                                                                         | Lifetime                                                | Who reads/writes it                                                                           |
| ------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **D1**             | Library data, groups, parts (insertables), configurations, users, favorites           | Permanent (until explicitly changed)                    | Backend Worker on every API request                                                           |
| **KV**             | Session tokens, borrowable admin sessions, workspace units                            | Sessions: 30 days. Units: a week.                       | Backend Worker, through a `kvStore` per key prefix                                            |
| **R2**             | Thumbnail images and per-library search indexes                                       | Until a load orphans them; indexes rewritten on rebuild | Backend Worker in `src/backend/features/thumbnails/` and `src/backend/features/library/db.ts` |
| **localStorage**   | UI state: theme, last tab and group, open/closed panels, search query, vendor filters | Persists across browser sessions                        | Frontend only, via `src/frontend/lib/ui-state.ts`                                             |
| **sessionStorage** | Not used                                                                              | —                                                       | —                                                                                             |

## Codebase Map

The source lives in two directories under `src/`: `backend/` (the Cloudflare
Worker) and `frontend/` (the React SPA). There is no shared directory — the
backend owns the contract, and the frontend imports it through `@backend/*`.

Both sides use the same shape: `features/<feature>/` for everything one feature
owns, `lib/` for cross-cutting plumbing, and a small set of files at the root.

### `src/backend/`

- `index.ts` — Worker entry point; exports the default app, the two Workflow classes and the `PushHub` Durable Object
- `app.ts` — composition root, and nothing else: binds the caller onto each request, mounts every feature's routes, and installs the error handler
- `db/` — `client.ts` (the Drizzle client) and `schema.ts` (table definitions)
- `lib/` — request plumbing shared by every feature: `context.ts` (bindings, typed context, and the caller binding), `cache.ts` (cache-control middleware), `api-error.ts` and `errors.ts` (the one shape every failed response takes), `validate.ts`, `route-params.ts`, `query-params.ts`
- `lib/onshape/` — everything that talks to Onshape's REST API: `client.ts` (the client class), `path.ts` (`ElementPath`/`InstancePath` and their serializers), `endpoints/` (per-category wrappers), `objects/` (feature and query builders)
- `features/` — one directory per feature, each holding its own `routes.ts` plus whatever it owns:
    - `auth/` — split by role: `session.ts` stores the session cookie and its KV records, `login.ts` holds a sign-in in flight, `onshape-oauth.ts` runs the handshake, `request-auth.ts` resolves who is calling (and exports `productionAuth`, the wiring `createApp` binds), `guards.ts` holds the route gates, and `routes.ts` serves the OAuth redirects plus `/access-data`
    - `entry/` — `/init`, where Onshape lands: gates on auth, then hands the launch to the app
    - `library/` — the library response (`db.ts`), its DTOs, and the groups and insertables endpoints
    - `load/` — everything that turns Onshape into what we store: the `parse-*` modules (document contents, configurations, configuration records, vendors, fasten info), the per-group and per-insertable loaders, the Workflows that drive them, their retry policies, and the job tracker
    - `configurations/` — the configuration domain the frontend shares: models, canonicalization, combination enumeration, and the input parser

    An element's own part number and material live on `insertables.part_metadata`; a `configurations` row exists exactly when the element has parameters to configure.
    - `thumbnails/` — rendering and R2 storage (`store.ts`), its Workflow, the routes, and the key and URL scheme the client shares
    - `build-checker/` — build issues, the checks that raise them, and the build-status endpoint
    - `webhooks/` — the per-document webhook that loads new versions, and transient ones for caches
    - `push/` — the `PushHub` Durable Object and what it pushes
    - `admin-team/` — each library's admin team, set by the owner and synced from Onshape
    - `version-manager/` — links between Onshape workspaces and the pushes and pulls along them
    - `favorites/`, `search/`, `analytics/`, `insert-location/`

### `src/frontend/`

- `main.tsx` — React root; wraps the app in `QueryClientProvider` and `MantineProvider`
- `routes/` — file-based TanStack Router routes
- `lib/` — cross-cutting helpers: `api-client.ts` (fetch wrappers), `query-keys.ts` (every query key in one place), `query-client.ts`, `ui-state.ts` (the Zustand store kept in localStorage), `onshape-params.ts` (the tab's Onshape launch, in sessionStorage), `refresh.ts`, `notifications.tsx`
- `components/` — UI used by more than one feature, plus the app shell (`app-navbar.tsx`, `alerts.tsx`, `root-error.tsx`)
- `features/` — `library/`, `favorites/`, `insert/`, `insert-location/`, `search/`, `settings/`, `thumbnails/`, `build-status/`, `admin-team/`, `dashboard/`, `auth/`, each with its queries and a `components/` directory

Other top-level files:

- `drizzle/` — SQL migration files generated by Drizzle Kit
- `wrangler.jsonc` — Cloudflare Workers config (bindings, routes, env vars)

## Access Levels

Four levels, per library: **owner** (the user `OWNER_USER_ID` names), **admin** and **editor** (team admins and members of the library's Onshape admin team), and **user** (anyone signed in). What each may do, how the team is synced, and the environment variables that affect access are in [architecture/auth.md](./architecture/auth.md).

## Architecture

Each area's design, invariants and failure modes live in [architecture/](./architecture/README.md): thumbnails, configurations, loading, favorites, and auth.
