# FRCDesignApp — Developer Guide

Step-by-step recipes for common development tasks. This guide assumes you've read [REFERENCE.md](./REFERENCE.md) and understand the overall system.

---

## Using the Onshape API Explorer (Glassworks)

Before writing any code that talks to Onshape, start with **Glassworks** — Onshape's interactive API browser. It lets you explore every available endpoint, understand what parameters it accepts, send live requests, and inspect real responses. Think of it as a Postman-style tool built into Onshape.

You can use Glassworks to see the list of publicly available APIs and test them against Onshape documents.

**URL:** `https://cad.onshape.com/glassworks/explorer`

**Tip:** The response shape you see in Glassworks is exactly what you'll get from `client.get(...)` in the backend. Use it to figure out what fields exist so you can type them correctly.

---

## Understanding Onshape Paths

This is the most important concept to understand before adding any Onshape API integration.

### How Onshape organizes content

Everything in Onshape is nested: a **Document** contains one or more **Workspaces** (or Versions, or Microversions), and each Workspace contains **Elements** (tabs — Part Studios, Assemblies, Feature Studios, etc.).

Each level has a unique string ID:

- `documentId` — identifies the document
- `instanceId` — identifies the workspace (or version, or microversion) within that document
- `instanceType` — `"w"` for workspace, `"v"` for version, `"m"` for microversion
- `elementId` — identifies a specific tab within the instance

In the database, Groups correspond to Documents (or more specifically Versions of a Document) and Insertables correspond to Elements (tabs).

### Path types in the codebase

These are defined in `src/shared/onshape-path.ts`:

```ts
// Just a document
interface DocumentPath {
    documentId: string;
}

// A document + a specific workspace/version/microversion
interface InstancePath extends DocumentPath {
    instanceId: string;
    instanceType: "w" | "v" | "m";
}

// A document + workspace + a specific element (tab)
interface ElementPath extends InstancePath {
    elementId: string;
}
```

You'll pass these around everywhere. When you need to call an Onshape endpoint, build the right path object and hand it to `apiPath()`.

### How Onshape REST URLs are structured

Onshape REST paths look like:

```
/documents/d/{documentId}/w/{workspaceId}/e/{elementId}/assemblies
```

The pattern is always: service → `/d/` → documentId → `/w/` or `/v/` or `/m/` → instanceId → `/e/` → elementId → endpoint action.

### `apiPath()` — building URLs

The `apiPath()` function in `src/backend/onshape-api/api-path.ts` assembles these URLs for you. You give it the service name, a path object, a serializer, and any options:

```ts
import { apiPath } from "../api-path";
import {
    toInstanceApiPath,
    toElementApiPath
} from "../../../shared/onshape-path";

// Produces: /assemblies/d/{did}/w/{wid}/e/{eid}/features
apiPath("assemblies", elementPath, toElementApiPath, { endRoute: "features" });

// Produces: /documents/d/{did}/w/{wid}/elements
apiPath("documents", instancePath, toInstanceApiPath, { endRoute: "elements" });
```

The serializer functions (`toDocumentApiPath`, `toInstanceApiPath`, `toElementApiPath`) are all defined in `src/shared/onshape-path.ts` and convert a path object into its URL segment string.

---

## Calling the Onshape API

All Onshape API calls go through the `OAuthApi` class, which is a wrapper around the Onshape API which handles authentication. For security reasons, the Onshape API is only available in the backend. The OAuthApi class can be retrieved inside any Hono route handler like this:

```ts
const onshapeApi = await c.var.getOnshapeApi();
```

You can then pass it to any function in `src/backend/onshape-api/endpoints/`:

```ts
import { getDocumentElements } from "../onshape-api/endpoints/documents";

const elements = await getDocumentElements(onshapeApi, instancePath);
```

Before writing a new wrapper function, check if it already exists in one of the files under `src/backend/onshape-api/endpoints/`.

---

## Adding a New Backend Route

Use this when you need to expose new functionality to the frontend via a new API endpoint.

### 1. Add the handler to a routes file

Open the relevant file in `src/backend/routes/` (or create a new one if the functionality is in a new area). Each file creates a Hono sub-app and registers handlers on it:

```ts
import { getApp, libraryRoute, getLibraryParam } from "../app";
import { getDb } from "../db";
// ... other imports

export const myRoutes = getApp();

/** GET /api/my-thing/library/:libraryId */
myRoutes.get("/my-thing" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);
    const onshapeApi = await c.var.getOnshapeApi();

    // ... do your work here

    return c.json({ result: "..." });
});
```

**Route param helpers** (defined in `src/backend/app.ts`):

- `libraryRoute()` — returns `"/library/:libraryId"`. Use `getLibraryParam(c)` to read it.
- `insertableRoute()` — returns `"/insertable/:insertableId"`. Use `getInsertableParam(c)`.
- `groupRoute()` — returns `"/group/:groupId"`. Use `getGroupParam(c)`.

**Protecting routes:** Wrap the handler with middleware if it requires elevated access:

```ts
import { requireEditorMiddleware } from "../access-level-utils";

myRoutes.post("/my-admin-action", requireEditorMiddleware, async (c) => {
    // only editors and admins reach here
});
```

### 2. Register the route group in `create-app.ts`

Open `src/backend/create-app.ts`, import your new routes, and mount them:

```ts
import { myRoutes } from "./routes/my-routes";

// Inside createApp():
app.route("/api", myRoutes);
```

### 3. Define the response type in shared

If the frontend needs to consume this endpoint, define a TypeScript interface for the response in `src/shared/api-models.ts` so both sides agree on the shape.

---

## Path Params, Query Params, and Request Bodies

HTTP gives you three places to put data in a request. Choosing the right one makes APIs easier to understand and use correctly.

### When to use each

| Type | Where it lives | Use for |
|------|---------------|---------|
| **Path param** | Embedded in the URL path: `/api/group/:groupId` | Identifying a specific resource. If removing it would make the URL ambiguous, it's a path param. |
| **Query param** | After the `?`: `/api/favorites?insertableId=abc` | Options, filters, or secondary identifiers on GET requests. |
| **Request body** | JSON payload sent with POST/DELETE | Structured data for mutations — things that create or update resources. |

### Frontend: sending params

```ts
// Path param — embed directly in the URL string
apiGet("/library-data" + toLibraryPath(libraryId));
// → GET /api/library-data/library/my-library

// Query param — pass as options.query
apiPost("/favorites" + toLibraryPath(libraryId), {
    query: { insertableId: "abc123", id: favoriteId }
});
// → POST /api/favorites/library/my-library?insertableId=abc123&id=...

// Request body — pass as options.body
apiPost("/add-group", {
    body: { documentId, name }
});
// → POST /api/add-group  (JSON body: { "documentId": "...", "name": "..." })
```

`apiGet`, `apiPost`, and `apiDelete` all accept `options.query` for query params. Only `apiPost` accepts `options.body` — GET and DELETE requests don't carry a body.

### Backend: reading params

```ts
// Path param — use a helper or c.req.param() directly
const libraryId = getLibraryParam(c);          // helper from app.ts
const groupId   = c.req.param("groupId");      // raw Hono API

// Query param
const insertableId = c.req.query("insertableId");

// Request body
const { documentId, name } = await c.req.json<{ documentId: string; name: string }>();
```

### Onshape API: sending params

When calling the Onshape API from the backend, the same concept applies:

- **Path params** are handled by `apiPath()` — the `ElementPath` / `InstancePath` fields become the path segments automatically.
- **Query params** for Onshape endpoints can be passed through the endpoint wrapper functions in `src/backend/onshape-api/endpoints/`, which append them to the URL returned by `apiPath()`.

---

## Modifying the Database Schema

The schema is the source of truth for what's stored in D1. Drizzle ORM reads it to generate both TypeScript types and SQL migrations.

### 1. Edit the schema

Open `src/shared/schema.ts`. Tables are defined using Drizzle's SQLite helpers:

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const myTable = sqliteTable("my_table", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    count: integer("count").default(0)
});
```

Every column you add here becomes available in TypeScript automatically — Drizzle infers the types.

### 2. Generate and commit the migration

```bash
npx drizzle-kit generate
```

This creates a new `.sql` file in `drizzle/`. A **migration** is a versioned SQL script that describes exactly what changed in the schema (e.g. "add column X to table Y"). Drizzle Kit generates it by comparing your current `schema.ts` against the previously generated state.

Always commit the generated migration file alongside your schema change. The migration is what actually updates the production database on deploy — the TypeScript schema in `schema.ts` drives Drizzle's type inference, but the SQL migration is what Cloudflare D1 applies.

> **Note:** While the app is under active development, migrations may be periodically squashed (merged into a single file) to keep the `drizzle/` directory manageable. If this happens, the local D1 database will need to be reset and re-migrated from scratch.

### 3. Apply it locally

```bash
npx wrangler d1 migrations apply DB --local
```

This runs all pending migrations against your local D1 database (used by `npx wrangler dev`).

### 4. Update API response types if needed

If the new data needs to be returned to the frontend, update the relevant interface in `src/shared/api-models.ts` and modify the query in `src/backend/library-data.ts` (if it's part of the main library response) or in the appropriate route handler.

---

## Adding a Frontend Route

TanStack Router uses **file-based routing**: the path of a `.tsx` file under `src/frontend/routes/` maps directly to a URL. No manual registration needed.

### 1. Create the route file

Create a `.tsx` file at the right path. For example, to add `/app/settings`:

```
src/frontend/routes/app/settings.tsx
```

Inside the file, export a `createFileRoute` call and a default component:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/settings")({
    component: SettingsPage
});

function SettingsPage() {
    return <div>Settings go here</div>;
}
```

### 2. Let the router regenerate

The next time you run `npm run dev`, TanStack Router's Vite plugin will detect the new file and update `src/frontend/routeTree.gen.ts` automatically. You don't need to touch that file.

### 3. Load data in the route (optional)

If your route needs data from the backend, you have two options:

**Option A — `loader` function (runs before the component renders):**

```tsx
export const Route = createFileRoute("/app/settings")({
    loader: () => apiGet("/my-settings"),
    component: SettingsPage
});

function SettingsPage() {
    const data = Route.useLoaderData();
    return <div>{data.name}</div>;
}
```

**Option B — React Query inside the component (runs when the component mounts):**

```tsx
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api-utils/api";

function SettingsPage() {
    const { data, isLoading } = useQuery({
        queryKey: ["my-settings"],
        queryFn: () => apiGet("/my-settings")
    });
    if (isLoading) return <div>Loading...</div>;
    return <div>{data.name}</div>;
}
```

Use the `loader` approach when you want the data to be ready before the page renders (avoids a loading flash). Use React Query when you want to re-fetch in the background or share the data with other components.

To read URL path parameters (e.g. `$groupId` in `/app/groups/$groupId`) inside a component, use `useParams`:

```tsx
import { useParams } from "@tanstack/react-router";

function GroupPage() {
    const { groupId } = useParams({ from: "/app/groups/$groupId" });
    // ...
}
```

---

## Adding a Frontend Data Fetch

If you just need to fetch data inside an existing component (without creating a new route), follow this pattern.

### 1. Define the query in `queries.ts`

Open `src/frontend/queries.ts` and add a query definition:

```ts
import { queryOptions } from "@tanstack/react-query";
import { apiGet } from "./api-utils/api";

export function getMyDataQuery(someId: string) {
    return queryOptions({
        queryKey: ["my-data", someId],
        queryFn: () => apiGet("/my-thing/" + someId)
    });
}
```

Keeping query definitions in `queries.ts` means the same query can be used in multiple components and they'll all share the same cache.

### 2. Use it in a component

```tsx
import { useQuery } from "@tanstack/react-query";
import { getMyDataQuery } from "../queries";

function MyComponent({ id }: { id: string }) {
    const { data, isLoading, isError } = useQuery(getMyDataQuery(id));

    if (isLoading) return <div>Loading...</div>;
    if (isError) return <div>Something went wrong.</div>;
    return <div>{data.name}</div>;
}
```

### Posting data (mutations)

For actions that change data (POST, DELETE), use React Query's `useMutation`. Mutations in this codebase follow a consistent pattern with three lifecycle callbacks:

```tsx
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { getQueryUpdater } from "../common/utils";
import { showSuccessToast } from "../common/notifications";
import { getAppErrorHandler } from "../api-utils/errors";
import { useRouter } from "@tanstack/react-router";

function useMyMutation(someId: string) {
    const router = useRouter();
    const queryKey = ["my-data", someId];

    return useMutation({
        mutationFn: () => apiPost("/do-thing", { body: { id: someId } }),

        // onMutate: optimistic update — runs BEFORE the request is sent.
        // Update the cache immediately so the UI reflects the change instantly.
        onMutate: async () => {
            // Cancel any in-flight fetches for this data so they don't land
            // and overwrite our optimistic update.
            await queryClient.cancelQueries({ queryKey });

            // Update the cache using Immer's produce() via getQueryUpdater.
            // Immer lets you mutate the draft directly — no spreading needed.
            queryClient.setQueryData(
                queryKey,
                getQueryUpdater((data: MyData) => {
                    data.someField = "new value";
                })
            );

            // Tell TanStack Router that route loader data may be stale.
            void router.invalidate();
        },

        // onError: show a toast if the request fails.
        onError: getAppErrorHandler("Unexpectedly failed to do thing."),

        // onSuccess: show a success toast if the request succeeds.
        onSuccess: () => {
            showSuccessToast("Done!");
        },

        // onSettled: runs regardless of success or failure.
        // Invalidate queries to re-sync with the real server state.
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey });
            void router.invalidate();
        }
    });
}
```

**`getQueryUpdater` and Immer:** `getQueryUpdater` (from `src/frontend/common/utils.ts`) wraps Immer's `produce()` into a function that React Query's `setQueryData` accepts. Immer lets you write direct mutations on a `draft` copy (e.g. `draft.items.push(x)`) instead of building a new object with spread syntax — this is much cleaner for nested data. The original cache value is never mutated; Immer produces a new immutable result.

**Why cancel queries in `onMutate`?** If a background refetch lands after the optimistic update, it will overwrite the cache with stale data. Canceling outstanding queries for that key prevents this race condition.

**Why invalidate in `onSettled`?** `onSettled` always runs, even on failure. Invalidating triggers a fresh server fetch to confirm the real state — if the optimistic update was wrong (e.g. the server rejected the change), this corrects it.

---

## Working with Frontend TypeScript, TSX, and SCSS

### `.ts` vs `.tsx` — what's the difference?

TypeScript comes in two flavors in this project:

- **`.ts`** — plain TypeScript. Logic, utilities, hooks, types. No JSX allowed.
- **`.tsx`** — TypeScript with JSX support. Required any time you write angle-bracket syntax like `<Button />` or `<div>`.

The rule of thumb: if a file contains any UI markup, it must be `.tsx`. Everything else should be `.ts`.

> **Vite / Fast Refresh constraint:** Vite's React plugin uses React Fast Refresh for hot-module replacement during development. Fast Refresh works best when each `.tsx` file exports *only* React components (functions whose names start with a capital letter and return JSX). If you mix component exports with non-component exports (plain functions, constants, classes) in the same `.tsx` file, you'll see a warning and HMR may fall back to a full page reload. To avoid this, put utility functions and hooks in a sibling `.ts` file and import them into your `.tsx` component file.

---

### What is a JSX component?

A React component is just a TypeScript function that:

1. Takes a single `props` object as its argument (documented with an `interface`)
2. Returns something React can render — in this codebase that return type is always `ReactNode`

```tsx
import { ReactNode } from "react";

interface GreetingProps {
    name: string;
    /** Optional subtitle text shown below the name */
    subtitle?: string;
}

export function Greeting({ name, subtitle }: GreetingProps): ReactNode {
    return (
        <div>
            <h1>Hello, {name}!</h1>
            {subtitle && <p>{subtitle}</p>}
        </div>
    );
}
```

The angle-bracket syntax inside the `return` is JSX — it looks like HTML but it's actually TypeScript. `{name}` escapes back into TypeScript to embed a value. `{subtitle && <p>...</p>}` is a common pattern for conditional rendering: if `subtitle` is falsy, nothing renders.

The function name must start with a **capital letter** — that's how React distinguishes components (`<Greeting />`) from HTML elements (`<div>`).

**React components are pure functions.** Their only inputs are props (passed in from the parent) and hooks (called at the top level of the component). React tracks these inputs and skips re-running a component when none of its inputs have changed — this is how React stays fast even with large UIs.

```tsx
interface CardProps {
    title: string;
    onClick: () => void;
}

function Card({ title, onClick }: CardProps): ReactNode {
    // Props come from the parent. Hooks are the other input source.
    const [isHighlighted, setIsHighlighted] = useState(false);
    const { data } = useQuery(getCardDataQuery(title));

    return (
        <div
            onClick={onClick}
            style={{ background: isHighlighted ? "yellow" : undefined }}
            onMouseEnter={() => setIsHighlighted(true)}
            onMouseLeave={() => setIsHighlighted(false)}
        >
            {title} — {data?.subtitle}
        </div>
    );
}
```

Passing `onClick` as a prop (rather than defining behavior inside the component) is the key to composability: the parent decides what happens, the child decides how it looks.

---

### Factoring out components — keeping things composable

When a component gets long or has a distinct piece of UI that appears in multiple places, extract it into its own function. The goal is that each component does one clear thing and composes well with others.

```tsx
// Before: one big component
function InsertableCard({ item }: { item: InsertableOut }): ReactNode {
    return (
        <div>
            <img src={item.thumbnailUrls.tiny} />
            <span>{item.name}</span>
            <button onClick={...}>Insert</button>
            <button onClick={...}>Favorite</button>
        </div>
    );
}

// After: factored into focused sub-components
function CardThumbnail({ url }: { url: string }): ReactNode {
    return <img src={url} />;
}

function CardActions({ item }: { item: InsertableOut }): ReactNode {
    return (
        <>
            <button onClick={...}>Insert</button>
            <button onClick={...}>Favorite</button>
        </>
    );
}

function InsertableCard({ item }: { item: InsertableOut }): ReactNode {
    return (
        <div>
            <CardThumbnail url={item.thumbnailUrls.tiny} />
            <span>{item.name}</span>
            <CardActions item={item} />
        </div>
    );
}
```

A few guidelines:
- If you find yourself passing the same prop through multiple layers just so a deeply-nested component can use it, consider splitting the file or restructuring so the data is closer to where it's used.
- Sub-components that are only used inside one parent file don't need to be exported — keep them unexported (no `export` keyword) so it's clear they're internal.
- Sub-components that appear in more than one file belong in a shared file in the relevant feature directory.

---

### What is a hook?

A **hook** is a special function whose name starts with `use`. Hooks let you "hook into" React features — state, side effects, context — from inside a function component. You can only call hooks at the **top level** of a component or another hook (never inside loops, conditions, or nested functions).

React's built-in hooks you'll encounter in this codebase:

| Hook | What it does |
|------|-------------|
| `useState` | Stores a piece of state; re-renders the component when it changes |
| `useRef` | Holds a mutable value that does **not** trigger a re-render |
| `useEffect` | Runs a side effect (e.g. set up a listener) after render |
| `useLoaderData` | Reads the data returned by the current route's `loader` or `beforeLoad` function |
| `useParams` | Reads path parameters from the current URL (e.g. `groupId` in `/app/groups/$groupId`) |

For the full rules and explanation see the [official React docs on hooks](https://react.dev/reference/rules/rules-of-hooks).

**The rules of hooks (never break these):**

1. Only call hooks at the top level of a function — not inside `if`, `for`, or nested callbacks.
2. Only call hooks from React components or other hooks — never from plain utility functions.

If rule 1 tempts you to call a hook conditionally, the fix is to extract a sub-component and render it conditionally instead — the hook then lives at the top level of the sub-component, which only mounts when needed.

If rule 2 tempts you to call a hook from a utility function, make the utility function itself a hook (prefix it with `use`), and only call it from components or other hooks.

---

### Custom hooks

A custom hook is just a regular TypeScript function that starts with `use` and calls other hooks inside. You write them to extract repeated stateful logic out of components so it can be shared and tested independently.

Example from this codebase — `useUiState()` in `src/frontend/api-utils/ui-state.ts`:

```ts
// In ui-state.ts (a .ts file — no JSX, so no .tsx needed)
export function useUiState(): [UiState, SetUiState] {
    const reactUiState = useSyncExternalStore(subscribeToUiState, getUiState);
    return [reactUiState, updateUiState];
}

// In a component:
function SearchBar(): ReactNode {
    const [uiState, setUiState] = useUiState();
    return (
        <input
            value={uiState.searchQuery}
            onChange={(e) => setUiState({ searchQuery: e.target.value })}
        />
    );
}
```

The hook hides the `useSyncExternalStore` complexity so every component that needs UI state just calls `useUiState()`.

When to write a custom hook vs. a plain function:
- If your logic calls any React hook (`useState`, `useEffect`, etc.), it **must** be a hook (name starts with `use`, only called from components/hooks).
- If your logic is pure computation with no hooks inside, make it a plain function.

---

### SCSS in this project

SCSS (Sassy CSS) is a superset of CSS that adds variables, nesting, and other features. In this project it's used very sparingly — almost all styling comes from **Mantine's component system** and its CSS custom properties.

The only SCSS file is `src/frontend/main.scss`, imported once in `main.tsx`. It contains:

- `@layer mantine;` — declares the Mantine cascade layer. This is required at the top so that any global CSS you write outside of a layer wins over Mantine's defaults. Don't remove it.
- Global resets (like disabling text selection across the app)
- The `.interactive` utility class, which applies a pointer cursor and the standard Mantine hover background

**Mantine CSS variables** are the right way to match the app's visual style in custom CSS:

```scss
.my-element {
    background-color: var(--mantine-color-default-hover);
    color: var(--mantine-color-text);
    border-radius: var(--mantine-radius-sm);
}
```

Prefer Mantine component props (`c=`, `bg=`, `p=`, `radius=`) over adding new SCSS when possible — Mantine props are theme-aware and respond to light/dark mode automatically. Add to `main.scss` only for truly global styles or utility classes that Mantine doesn't cover.

---

## The `apiGet` / `apiPost` / `apiDelete` Helpers

These are thin wrappers around `fetch` defined in `src/frontend/api-utils/api.ts`. They:

- Automatically prepend `/api` to the path (so you write `"/context-data"` not `"/api/context-data"`)
- Serialize query parameters via `URLSearchParams`
- Append a `?v=` cache-busting parameter when `cacheId` is provided
- Parse the JSON response and throw a typed error if the response is not OK

You don't need to use `fetch` directly in frontend code — always use these helpers.
