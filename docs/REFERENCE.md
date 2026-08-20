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

| Prefix          | What it holds                                     | Lifetime                         |
| --------------- | ------------------------------------------------- | -------------------------------- |
| `thumbnails/`   | Rendered thumbnails, by element and configuration | See below                        |
| `search-index/` | Each library's serialized MiniSearch index        | Rewritten on every index rebuild |

Onshape can generate preview thumbnails for parts and assemblies, but fetching them from Onshape on every page load would be slow and eat into API rate limits — a single render can require polling and take minutes. Instead, every thumbnail we ever fetch from Onshape lands in R2 and is served from there afterwards.

Thumbnails are keyed by whether they are the element's default or a specific configuration:

```
thumbnails/default/{elementId}/{microversionId}/{size}                 # never expires
thumbnails/config/{elementId}/{microversionId}/{configKey}/{size}      # ~90 day lifecycle rule
```

The default is what everything else falls back to, so it must never be reclaimed. Configuration thumbnails expire under an R2 **lifecycle rule on the `config/` prefix**, which is configured on the bucket through the dashboard or API — it is not expressible in `wrangler.jsonc`, and it has to be set up before deploying. Per-prefix rules are what let `thumbnails/default/` and `search-index/` live in the same bucket without expiring.

`{configKey}` is a short hash of the _canonical_ configuration — the one spelling every equivalent selection shares, with hidden and default-valued parameters dropped and quantities expressed in meters and radians. That is what makes two equivalent selections resolve to one cached image. Including `{microversionId}` makes every object immutable, so an updated document lands on new keys rather than overwriting in place.

Thumbnails are served via `/api/thumbnail/:size/:elementId?v={microversionId}&c={canonicalConfiguration}&warm={bool}`:

- **Hit** — streamed from R2 as immutable, cacheable for a year.
- **Miss** — the element's default is served instead, for 60 seconds only, with an `X-Thumbnail-Fallback` header so the client knows to keep checking. An immutable fallback would pin the wrong image long after the real one landed.
- **Miss with `warm=true`** — the miss also starts a `ThumbnailWorkflow` to render the configuration. Surfaces where the user picked the configuration (the insert menu, favorites) warm; search rows do not, so one cold search cannot start a render per row.
- **Neither exists** — 404, and the client renders a placeholder.

All rendering happens inside the workflow, which keeps Onshape's thumbnail id server-side. There is no HTTP path that proxies an Onshape thumbnail directly.

### Workflows — Background Jobs

Cloudflare Workflows let you run a long-running background job that survives beyond a single HTTP request's time limit. They are the only async primitive here — there are no Queues, Durable Objects, or cron triggers. All three are defined in `src/backend/features/library/workflows/`:

| Binding                 | Class                 | What it does                                                                         |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------ |
| `LOAD_LIBRARY_WORKFLOW` | `LoadLibraryWorkflow` | Reloads every group whose document has a new version, then rebuilds the search index |
| `ADD_GROUP_WORKFLOW`    | `AddGroupWorkflow`    | Adds an Onshape document to a library and loads it                                   |
| `THUMBNAIL_WORKFLOW`    | `ThumbnailWorkflow`   | Renders one configuration's thumbnails and stores them in R2                         |

Loading a group means walking the document structure, downloading metadata for every part and assembly, probing each indexed configuration, generating thumbnails, and writing it all to D1 — far too long for a single HTTP request. The request kicks the workflow off and returns immediately.

Each workflow carries the requesting user's `sessionId`, since it calls Onshape under their tokens after the request has ended.

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
5. Onshape redirects back to `/auth/callback?code=...&state=...`.
6. The callback handler reads the session from KV, verifies the `state` matches (preventing CSRF attacks), and exchanges the `code` for real access and refresh tokens using the [Arctic](https://arcticjs.dev/) OAuth library.
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
- `app.ts` — composition root: injects per-request services, mounts every feature's routes, and handles errors
- `db/` — `client.ts` (the Drizzle client) and `schema.ts` (table definitions)
- `lib/` — request plumbing shared by every feature: `context.ts` (bindings and typed context), `cache.ts` (cache-control middleware), `route-params.ts`, `query-params.ts`
- `lib/onshape/` — everything that talks to Onshape's REST API: `client.ts` (the client class), `api-path.ts`, `path.ts` (`ElementPath`/`InstancePath` and their serializers), `endpoints/` (per-category wrappers), `objects/` (feature and query builders)
- `features/` — one directory per feature, each holding its own `routes.ts` plus whatever it owns:
    - `auth/` — OAuth flow (`onshape-oauth.ts`), session storage (`session.ts`), and the two authorization gates: `sign-in.ts` (signed in to Onshape at all) and `access-control.ts` (on the admin team)
    - `users/` — user preferences and the `Settings` model
    - `library/` — the library response (`db.ts`), its DTOs, groups and insertables, and `workflows/` (the three Workflows, their retry policies, and the job tracker)
    - `configurations/` — configuration models, canonicalization, combination enumeration, and the Onshape parsers
    - `thumbnails/` — thumbnail routes plus the R2 key and URL scheme the client shares
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

The app has three access levels, checked on every protected API call: **ADMIN**, **EDITOR**, and **USER**. Admin and editor access currently grant the same permissions (adding, removing, and renaming groups, toggling insertable visibility), but they are kept separate so permissions can be tightened in the future if needed. USER access allows anyone who logs in via OAuth to browse the library, insert parts, and manage their own favorites.

The Worker determines a user's access level in `src/backend/features/auth/services.ts` by calling the Onshape API to check team membership against the `ADMIN_TEAM` binding. Backend routes that require elevated access are wrapped with `requireEditorMiddleware` or `requireAdminMiddleware` from `src/backend/features/auth/access-control.ts`.

During local development, you can bypass the team membership check by setting `ACCESS_LEVEL_OVERRIDE=admin` (or `editor`/`user`) in your `.env` file.
