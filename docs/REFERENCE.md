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

Every thumbnail is read from a **workspace branched off the version** the library shows, not from the version itself — Onshape sometimes never renders an element's thumbnail in a version — and not from the document's own workspace, which moves on from that version. A load finds or creates the branch (`FRCDesignApp Thumbnails (DO NOT EDIT)`, its version recorded in its description; `features/thumbnails/workspace.ts`), stores its id on the group row beside the version, and deletes the branches of older versions once the group has moved on. A fresh branch has no thumbnails for a few minutes, so a load's thumbnail steps retry for about 17 minutes, under a limiter of their own so the wait never holds up probing.

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

Thumbnails are served via `/api/thumbnail/:size/:elementId?v={microversionId}&configurationKey=&renderSource=&insertableId=`:

- **Hit** — streamed from R2 as immutable, cacheable for a year.
- **Miss** — 404, uncached, so a render landing later is not shadowed. A configuration miss is never answered with the element's default: that would show a part the caller did not ask for. The client shows the default itself while it waits.
- **Miss with `renderSource` and `insertableId`** — the route also starts a `RenderThumbnailWorkflow` for the configuration (`features/thumbnails/render.ts`). The insert menu and favorite rows ask for this; search rows do not, so one cold search cannot start a render per row.
    - The instance id is a hash of the element, microversion and key, so every poll for one render finds the same instance and starts nothing new.
    - Only when there is no instance does the route spend an Onshape call, resolving the thumbnail id once. Onshape having no insertable for the configuration answers 422 at once, which the client shows as a configuration that failed to regenerate.
    - The workflow is handed that id and both R2 keys, the size the asking surface shows first leading, and asks Onshape for the bytes until they land (404 means still rendering), for about a minute.
    - A finished instance found on a miss left no bytes behind, so it is restarted.

### Workflows — Background Jobs

Cloudflare Workflows let you run a long-running background job that survives beyond a single HTTP request's time limit. The load workflow lives in `src/backend/features/load/workflows.ts`; the thumbnail one lives with the feature it serves, in `src/backend/features/thumbnails/render-workflow.ts`:

| Binding                     | Class                     | What it does                                                                  |
| --------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `LOAD_DOCUMENT_WORKFLOW`    | `LoadDocumentWorkflow`    | Loads one group's document when its version moved on (or always, when forced) |
| `RENDER_THUMBNAIL_WORKFLOW` | `RenderThumbnailWorkflow` | Waits out one configuration's render and stores both sizes in R2              |

Loading a group means walking the document structure, downloading metadata for every part and assembly, probing each indexed configuration, generating thumbnails, and writing it all to D1 — far too long for a single HTTP request. The request kicks the workflow off and returns immediately.

Every load is one document: adding a document, a new version of one (see Webhooks below), and the owner's "reload everything", which starts one per group. `features/load/jobs.ts` keeps at most one load per group running, in the `load_jobs` table: a load asked for while one runs is marked on that row, and the running load starts it as it finishes. The last load to finish in a library rebuilds its search index, once rather than per document.

Each workflow carries a `sessionId` whose tokens it calls Onshape under after the request has ended: the requesting user's, or the owner's for a webhook.

### Webhooks and live updates

Onshape pushes two things, registered with `isTransient: false` and recorded in the `onshape_webhooks` table, each with its own token in the delivery url (`features/webhooks`):

- **A new version of a library document.** Registered by the document's load; removed with the last group loaded from it. Reloads that document's groups.
- **A change to an admin team's members.** Registered when the owner sets a library's admin team. Pulls the team's members again.

The server pushes to open clients over a WebSocket held by the `LiveUpdates` Durable Object (`features/live`): jobs starting and finishing, a library's new version, and a configuration's render landing. Clients poll only while that connection is down.

### Assets — Static File Serving (`c.env.ASSETS`)

The compiled React app (HTML, JS, CSS) is served directly by Cloudflare's asset infrastructure. The Worker only intercepts three path patterns: `/init`, `/api/*`, and `/auth/*`. Everything else (the SPA files, icons, fonts) is served from the static asset bundle without going through Worker code.

The asset binding is configured with `single-page-application` mode, which means any unrecognized path serves `index.html` — necessary for client-side routing to work.

## How Users Get Into the App

This app runs inside an Onshape iframe, which adds some authentication complexity. Here is the complete flow from first page load to seeing the part library.

### Normal flow (already logged in)

1. Onshape loads the app's iframe by navigating to `/init?documentId=...&workspaceId=...&elementId=...` with the current document's identifiers in the URL.
2. The Worker checks if the request has a valid session cookie (`frc-design-app-cookie`) and whether the stored tokens are still valid.
3. If everything checks out, the Worker serves the React app (`index.html`), which then loads and navigates to `/app/groups`.
4. The React app calls `/api/context-data` to get user info and access level, then prefetches the library data, search index, and favorites.
5. The UI renders.

### First-time flow (OAuth)

1. Same as above — Onshape loads `/init`.
2. The Worker finds no valid session cookie. It redirects to `/auth/sign-in?redirectUrl=<the /init URL>`.
3. The sign-in handler generates a random `state` string (a security measure), stores `{ state, redirectUrl }` in KV under a random session ID, sets the session cookie, and redirects the user to Onshape's OAuth login page.
4. The user sees the Onshape "Authorize App" screen and clicks approve.
5. Onshape redirects back to `/auth/callback?code=...&state=...`. The sign-in names that callback as the `redirect_uri`, taken from the origin the request came in on, so Onshape returns the user to the host they signed in on rather than to whichever redirect URL it would otherwise pick — which is what lets two hosts share one OAuth app during a cutover. Every origin the app answers on has to be one of the redirect URLs registered on the OAuth app, spelled exactly.
6. The callback handler reads the session from KV, verifies the `state` matches (preventing CSRF attacks), and exchanges the `code` for real access and refresh tokens using the [Arctic](https://arcticjs.dev/) OAuth library. The exchange repeats the same `redirect_uri`, as OAuth requires.
7. The tokens are saved to KV under the session ID. The temporary login-session entry is deleted.
8. The user is redirected back to the original `/init` URL, which now succeeds because the session cookie and tokens are in place.

### What happens on the client after auth

Once the backend confirms authentication and serves the React app, the frontend takes over:

1. The `/init` route normalizes the Onshape URL parameters (document ID, workspace ID, element ID, theme, etc.) and stores them in the URL query string. TanStack Router carries these parameters forward automatically via `retainSearchParams`, so child routes can always read them.
2. `/init`'s `beforeLoad` immediately redirects to `/app/groups` (or to the last-opened group if one is saved in `localStorage`).
3. The `/app` route's `beforeLoad` calls `getContextDataQuery()` — a blocking fetch that retrieves user settings (including the `libraryId` and `cacheVersion`) and access level before any child route renders.
4. The `/app` route's `loader` uses the `cacheVersion` to kick off three prefetches in parallel: the full library data, the search index, and the user's favorites.
5. With all data already in the React Query cache, the groups page renders immediately with no loading spinners.

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
