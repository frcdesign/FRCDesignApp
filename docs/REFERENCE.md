# FRCDesignApp — System Reference

This document explains what FRCDesignApp is, how its pieces fit together, and where to find things in the codebase. If you want step-by-step recipes for adding new features, see [GUIDE.md](./GUIDE.md).

---

## What Is This App?

FRCDesignApp is a part-library browser that runs **inside Onshape** as an embedded tab (technically an iframe). When a user opens an Onshape assembly document, they can open this app in a side panel, browse a curated library of FRC robot parts organized into groups, and click a part to insert it directly into their assembly.

The app is hosted on **Cloudflare's edge network**, so there is no traditional server — instead, all backend logic runs as a Cloudflare Worker (a serverless function that runs close to the user). The frontend is a React single-page application served as static files from the same Cloudflare deployment.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend UI | React 19 + [Mantine](https://mantine.dev/) | React for component model; Mantine for a rich set of pre-built accessible UI components (modals, menus, notifications, etc.) |
| Frontend routing | [TanStack Router](https://tanstack.com/router) | File-based routing: each `.tsx` file under `src/frontend/routes/` automatically becomes a URL route. Type-safe navigation. |
| Server-state caching | [TanStack Query (React Query)](https://tanstack.com/query) | Handles fetching, caching, and revalidating data from the backend. Prevents redundant network requests and keeps the UI in sync. |
| Backend framework | [Hono](https://hono.dev/) | A lightweight HTTP framework (similar to Express, but designed for edge runtimes like Cloudflare Workers). |
| Database ORM | [Drizzle ORM](https://orm.drizzle.team/) | Type-safe SQL query builder. Schema is defined in TypeScript and migrations are generated automatically. |
| Build tool | [Vite](https://vite.dev/) + `@cloudflare/vite-plugin` | Bundles both the React SPA and the Cloudflare Worker in one build step. |
| Validation | [Zod](https://zod.dev/) | Runtime schema validation, used for API responses, URL params, and localStorage state. |
| Testing | [Vitest](https://vitest.dev/) + `@cloudflare/vitest-pool-workers` | Runs tests inside a Workers runtime so tests accurately reflect the production environment. |

---

## Cloudflare Services

The app uses five Cloudflare products. Each one is declared as a **binding** in `wrangler.jsonc` and accessed in Worker code via `c.env.<BINDING_NAME>`.

### D1 — The Database (`c.env.DB`)

D1 is Cloudflare's managed SQLite database. It is the app's primary persistent store — everything about libraries, groups, parts, users, and favorites lives here.

Queries go through **Drizzle ORM** so you write TypeScript instead of raw SQL. The schema is defined in `src/shared/schema.ts`. SQL migration files live in `drizzle/` and are applied automatically on deploy.

**Tables:** `libraries`, `groups`, `insertables`, `configurations`, `users`, `favorites`

### KV — Session & Token Storage (`c.env.KV`)

KV is a key-value store (like a global dictionary). The app uses it exclusively for **authentication**:

- During the OAuth login flow, it briefly stores the OAuth `state` and the URL to redirect back to after login.
- After login succeeds, it stores the user's access token and refresh token, keyed to their session cookie.

KV is the right tool here because Cloudflare Workers are stateless — there is no in-memory session that persists between requests. KV gives us a fast, durable place to stash tokens between requests.

### R2 — Thumbnail Storage (`c.env.THUMBNAILS`)

R2 is Cloudflare's object storage (similar to Amazon S3). The app uses it as a **thumbnail image cache**.

Onshape can generate preview thumbnails for parts and assemblies, but fetching them from Onshape on every page load would be slow and eat into API rate limits. Instead, we fetch a thumbnail from Onshape the first time it's needed, store it in R2, and serve it from R2 on all subsequent requests. Thumbnails are served via `/api/thumbnail/:size/:elementId`.

### Workflows — Document Sync (`c.env.LOAD_DOCUMENT_WORKFLOW`)

Cloudflare Workflows let you run a long-running background job that survives beyond a single HTTP request's time limit.

When a user adds a new group (a new Onshape document) to the library, the app needs to walk the entire document structure, download metadata for every part and assembly, generate thumbnails, and write everything to D1. This can take many seconds — too long to do in a single HTTP request without timing out.

The `LoadDocumentWorkflow` class (defined in `src/backend/parse/load-document.ts`) handles this process as a background job. The HTTP request just kicks it off and returns immediately; the workflow runs to completion independently.

### Assets — Static File Serving (`c.env.ASSETS`)

The compiled React app (HTML, JS, CSS) is served directly by Cloudflare's asset infrastructure. The Worker only intercepts three path patterns: `/init`, `/api/*`, and `/auth/*`. Everything else (the SPA files, icons, fonts) is served from the static asset bundle without going through Worker code.

The asset binding is configured with `single-page-application` mode, which means any unrecognized path serves `index.html` — necessary for client-side routing to work.

---

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

### Token refresh

Access tokens expire. When any Onshape API call returns a `401 Unauthorized`, `OAuthApi` automatically calls Onshape's token endpoint with the stored refresh token to get a new access token, saves it to KV, and retries the original request — all transparently.

### Why `SameSite=None` on the cookie?

The app runs inside an Onshape iframe. Browsers block cookies from being sent in cross-site iframes unless the cookie has `SameSite=None; Secure`. Without this, the session cookie would never be sent and the user would be stuck in an auth loop.

---

## Storage at a Glance

| Store | What it holds | Lifetime | Who reads/writes it |
|---|---|---|---|
| **D1** | Library data, groups, parts (insertables), configurations, user preferences, favorites | Permanent (until explicitly changed) | Backend Worker on every API request |
| **KV** | OAuth session state (during login) and auth tokens (after login) | Login state: 10 minutes. Tokens: 30 days. | Backend Worker in `src/backend/auth.ts` |
| **R2** | Part and group thumbnail images | Indefinite (30-day browser cache-control) | Backend Worker in `src/backend/routes/thumbnails.ts` |
| **localStorage** | UI state: open/closed panels, active search query, vendor filters, last-opened group | Persists across browser sessions | Frontend only, via `src/frontend/api-utils/ui-state.ts` |
| **sessionStorage** | Not used | — | — |

---

## Codebase Map

```
FRCDesignApp/
├── src/
│   ├── backend/              # Cloudflare Worker — all server-side code
│   │   ├── index.ts          # Worker entry point; exports the Hono app and the Workflow class
│   │   ├── app.ts            # Hono app factory, AppBindings/AppContext types, route-param helpers
│   │   ├── create-app.ts     # Composition root: mounts all route groups onto the Hono app
│   │   ├── auth.ts           # OAuth flow, session cookie management, token storage/retrieval
│   │   ├── db.ts             # Drizzle ORM client factory (wraps c.env.DB)
│   │   ├── services.ts       # Dependency injection: getOnshapeApi(), getUserId(), getAccessLevel()
│   │   ├── library-data.ts   # Assembles full library response (groups + insertables + configs)
│   │   ├── access-level-utils.ts  # requireEditorMiddleware, requireAdminMiddleware
│   │   ├── routes/           # One file per logical area; each exports a Hono sub-app
│   │   │   ├── user.ts       # GET /api/context-data, GET /api/unit-info
│   │   │   ├── library.ts    # GET /api/library-data/library/:libraryId, GET /api/search-db/...
│   │   │   ├── groups.ts     # POST /api/add-group, POST /api/rename-group, DELETE /api/group/:id
│   │   │   ├── insertables.ts  # POST /api/toggle-open-composite, POST /api/toggle-insert-and-fasten
│   │   │   ├── favorites.ts  # CRUD for user favorites
│   │   │   ├── thumbnails.ts # GET /api/thumbnail/:size/:elementId (serves from R2)
│   │   │   └── configurations.ts  # POST /api/save-configuration
│   │   ├── onshape-api/      # All code that talks to Onshape's REST API
│   │   │   ├── onshape-api.ts   # OnshapeApi base class, OAuthApi, KeyApi
│   │   │   ├── api-path.ts      # apiPath() — builds Onshape REST URL paths
│   │   │   └── endpoints/    # One file per Onshape API category
│   │   │       ├── documents.ts
│   │   │       ├── assemblies.ts
│   │   │       ├── part-studios.ts
│   │   │       ├── feature-studios.ts
│   │   │       ├── configurations.ts
│   │   │       ├── thumbnails.ts
│   │   │       ├── users.ts
│   │   │       ├── permissions.ts
│   │   │       ├── metadata.ts
│   │   │       ├── versions.ts
│   │   │       └── settings.ts
│   │   └── parse/            # Document sync logic
│   │       ├── load-document.ts     # LoadDocumentWorkflow — syncs an Onshape document into D1
│   │       ├── parse-configuration.ts  # Parses Onshape feature configs into app model
│   │       └── insert-and-fasten.ts  # Derives fasten/mate info for assemblies
│   │
│   ├── frontend/             # React SPA
│   │   ├── main.tsx          # React root — wraps the app in providers (QueryClient, Mantine)
│   │   ├── router.ts         # Creates TanStack Router instance from the generated route tree
│   │   ├── routeTree.gen.ts  # Auto-generated by TanStack Router; do not edit by hand
│   │   ├── queries.ts        # React Query query definitions (getLibraryQuery, getFavoritesQuery, etc.)
│   │   ├── query-client.ts   # Configured React Query client
│   │   ├── theme.ts          # Mantine theme configuration
│   │   ├── routes/           # File-based routes — each file = one URL
│   │   │   ├── __root.tsx    # Root layout: providers, loads context-data
│   │   │   ├── init.tsx      # Entry point from Onshape; auth guard
│   │   │   ├── app/
│   │   │   │   ├── route.tsx      # App shell (header, sidebar); prefetches library + favorites
│   │   │   │   └── groups/
│   │   │   │       ├── index.tsx  # Groups list view
│   │   │   │       └── $groupId.tsx  # Individual group view
│   │   │   └── _pages/       # Standalone error pages (safari-error, cookie-error, etc.)
│   │   ├── api-utils/        # Frontend helpers for talking to the backend
│   │   │   ├── api.ts        # apiGet(), apiPost(), apiDelete() — thin fetch wrappers
│   │   │   ├── ui-state.ts   # localStorage-backed UI state with React hook
│   │   │   ├── library.ts    # useLibraryId(), toLibraryPath() helpers
│   │   │   ├── access-level.tsx  # RequireAccessLevel guard component
│   │   │   └── onshape-params.ts  # Reads theme/document params passed in from Onshape
│   │   ├── cards/            # Insertable card components
│   │   ├── insert/           # Insert dialog and configuration selector
│   │   ├── favorites/        # Favorites sidebar and management UI
│   │   ├── groups/           # Group card and add-group menu
│   │   ├── search/           # Full-text search (backed by MiniSearch)
│   │   └── settings/         # Theme and vendor-filter settings
│   │
│   └── shared/               # Code used by both frontend and backend
│       ├── schema.ts         # Drizzle table definitions (the database schema)
│       ├── types.ts          # Shared enums (AccessLevel, Vendor, Theme) and core interfaces
│       ├── api-models.ts     # TypeScript types for API request/response shapes
│       ├── configuration-models.ts  # Types for Onshape configuration parameters
│       ├── onshape-path.ts   # ElementPath, InstancePath types + serialization helpers
│       └── search.ts         # MiniSearch index configuration
│
├── drizzle/                  # SQL migration files (generated by Drizzle Kit, committed to repo)
├── public/                   # Static assets (favicon, icons)
├── wrangler.jsonc            # Cloudflare Workers config: bindings, routes, env vars
├── vite.config.ts            # Vite build config
└── vitest.config.ts          # Vitest test config
```

---

## Access Levels

The app has three access levels, checked on every protected API call:

| Level | Who | What they can do |
|---|---|---|
| **ADMIN** | Members of the Onshape team specified by the `ADMIN_TEAM` binding | Everything: add/remove/rename groups, toggle insertable visibility, manage the library |
| **EDITOR** | (Currently same check as admin, but the concept is separate) | Add and rename groups |
| **USER** | Anyone who successfully logs in via OAuth | Browse the library, insert parts, manage their own favorites |

The Worker determines a user's access level in `src/backend/services.ts` by calling the Onshape API to check team membership. The result is cached per-request via the Hono context.

Backend routes that require elevated access are wrapped with `requireEditorMiddleware` or `requireAdminMiddleware` from `src/backend/access-level-utils.ts`.

During local development, you can bypass the team membership check by setting `ACCESS_LEVEL_OVERRIDE=admin` (or `editor`/`user`) in your `.env` file.
