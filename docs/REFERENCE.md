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

Queries go through **Drizzle ORM** so you write TypeScript instead of raw SQL. The schema is defined in `src/shared/schema.ts`. SQL migration files live in `drizzle/` and are applied automatically on deploy.

### KV — Session & Token Storage (`c.env.KV`)

KV is a key-value store (like a global dictionary). The app uses it exclusively for **authentication**:

- During the OAuth login flow, it briefly stores the OAuth `state` and the URL to redirect back to after login.
- After login succeeds, it stores the user's access token and refresh token, keyed to their session cookie.

KV serves as a cheap, lightweight way to persist user data across multiple Cloudflare Workers (which Cloudflare automatically scales and provisions based on the app's current traffic). Because Workers are stateless — there is no in-memory session that persists between requests — KV is the right place to stash tokens between requests.

### R2 — Thumbnail Storage (`c.env.THUMBNAILS`)

R2 is Cloudflare's blob storage, optimized for unstructured data like images and PDFs. The app uses it to store and cache thumbnails in order to improve reliability.

Onshape can generate preview thumbnails for parts and assemblies, but fetching them from Onshape on every page load would be slow and eat into API rate limits. Instead, we fetch a thumbnail from Onshape the first time it's needed, store it in R2, and serve it from R2 on all subsequent requests. Thumbnails are served via `/api/thumbnail/:size/:elementId`.

### Workflows — Document Sync (`c.env.LOAD_DOCUMENT_WORKFLOW`)

Cloudflare Workflows let you run a long-running background job that survives beyond a single HTTP request's time limit.

When a user adds a new group (a new Onshape document) to the library, the app needs to walk the entire document structure, download metadata for every part and assembly, generate thumbnails, and write everything to D1. This can take many seconds — too long to do in a single HTTP request without timing out.

The `LoadDocumentWorkflow` class (defined in `src/backend/parse/load-document.ts`) handles this process as a background job. The HTTP request just kicks it off and returns immediately; the workflow runs to completion independently.

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

| Store              | What it holds                                                                          | Lifetime                                  | Who reads/writes it                                     |
| ------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| **D1**             | Library data, groups, parts (insertables), configurations, user preferences, favorites | Permanent (until explicitly changed)      | Backend Worker on every API request                     |
| **KV**             | OAuth session state (during login) and auth tokens (after login)                       | Login state: 10 minutes. Tokens: 30 days. | Backend Worker in `src/backend/auth.ts`                 |
| **R2**             | Part and group thumbnail images                                                        | Indefinite (30-day browser cache-control) | Backend Worker in `src/backend/routes/thumbnails.ts`    |
| **localStorage**   | UI state: open/closed panels, active search query, vendor filters, last-opened group   | Persists across browser sessions          | Frontend only, via `src/frontend/api-utils/ui-state.ts` |
| **sessionStorage** | Not used                                                                               | —                                         | —                                                       |

## Codebase Map

The source code lives in three directories under `src/`:

### `src/shared/`

Code used by both the frontend and backend. Key files:

- `schema.ts` — Drizzle table definitions (the database schema)
- `types.ts` — shared enums (`AccessLevel`, `Vendor`, `Theme`) and core interfaces
- `api-models.ts` — TypeScript types for API request/response shapes
- `onshape-path.ts` — `ElementPath`, `InstancePath` types and the serialization helpers used to build Onshape REST URLs

### `src/backend/`

The Cloudflare Worker. Key files and folders:

- `index.ts` — Worker entry point; exports the Hono app and the Workflow class
- `auth.ts` — OAuth flow, session cookie management, token storage/retrieval
- `services.ts` — provides `getOnshapeApi()`, `getUserId()`, `getAccessLevel()` to route handlers
- `library-data.ts` — assembles the full library response (groups + insertables + configurations)
- `routes/` — endpoints callable by the frontend
- `onshape-api/` — all code that communicates with Onshape's REST API (`onshape-api.ts` for the client class, `api-path.ts` for URL construction, `endpoints/` for per-category wrappers)
- `parse/` — `load-document.ts` runs the Cloudflare Workflow that syncs an Onshape document into D1

### `src/frontend/`

The React SPA. Key files and folders:

- `main.tsx` — React root; wraps the app in `QueryClientProvider` and `MantineProvider`
- `queries.ts` — React Query query definitions shared across the app
- `routes/` — file-based routes (`__root.tsx`, `init.tsx`, `app/route.tsx`, `app/groups/index.tsx`, `app/groups/$groupId.tsx`)
- `api-utils/` — helpers for talking to the backend (`api.ts` for fetch wrappers, `ui-state.ts` for localStorage state, `library.ts` for library ID helpers)

Everything else under `src/frontend/` is organized by feature: `cards/`, `insert/`, `favorites/`, `groups/`, `search/`, `settings/`.

Other top-level files:

- `drizzle/` — SQL migration files generated by Drizzle Kit
- `wrangler.jsonc` — Cloudflare Workers config (bindings, routes, env vars)

## Access Levels

The app has three access levels, checked on every protected API call: **ADMIN**, **EDITOR**, and **USER**. Admin and editor access currently grant the same permissions (adding, removing, and renaming groups, toggling insertable visibility), but they are kept separate so permissions can be tightened in the future if needed. USER access allows anyone who logs in via OAuth to browse the library, insert parts, and manage their own favorites.

The Worker determines a user's access level in `src/backend/services.ts` by calling the Onshape API to check team membership against the `ADMIN_TEAM` binding. Backend routes that require elevated access are wrapped with `requireEditorMiddleware` or `requireAdminMiddleware` from `src/backend/access-level-utils.ts`.

During local development, you can bypass the team membership check by setting `ACCESS_LEVEL_OVERRIDE=admin` (or `editor`/`user`) in your `.env` file.
