# FRCDesignApp — Developer Guide

Step-by-step recipes for common development tasks. This guide assumes you've read [REFERENCE.md](./REFERENCE.md) and understand the overall system.

---

## Using the Onshape API Explorer (Glassworks)

Before writing any code that talks to Onshape, start with **Glassworks** — Onshape's interactive API browser. It lets you explore every available endpoint, understand what parameters it accepts, send live requests, and inspect real responses. Think of it as a Postman-style tool built into Onshape.

**URL:** `https://cad.onshape.com/glassworks/explorer`

### How to use it

1. **Open Glassworks** in your browser. You'll see a list of API categories on the left (Documents, Assemblies, PartStudios, etc.).
2. **Authenticate:** Click the green **Authorize** button at the top of the page. Log in with your Onshape account. This lets Glassworks make real API calls on your behalf.
3. **Find your endpoint:** Browse the categories or use the search bar. Each endpoint shows its HTTP method (GET, POST, DELETE), path, and a description.
4. **Try it out:** Click on an endpoint, then click **Try it out**. Fill in any required parameters (you can get document/workspace/element IDs from the URL of an Onshape document), then click **Execute**.
5. **Inspect the response:** Glassworks shows the full JSON response, the HTTP status code, and the request URL. This is the ground truth for what you'll get when you call the same endpoint from code.

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
import { toInstanceApiPath, toElementApiPath } from "../../../shared/onshape-path";

// Produces: /assemblies/d/{did}/w/{wid}/e/{eid}/features
apiPath("assemblies", elementPath, toElementApiPath, { endRoute: "features" })

// Produces: /documents/d/{did}/w/{wid}/elements
apiPath("documents", instancePath, toInstanceApiPath, { endRoute: "elements" })
```

The serializer functions (`toDocumentApiPath`, `toInstanceApiPath`, `toElementApiPath`) are all defined in `src/shared/onshape-path.ts` and convert a path object into its URL segment string.

---

## Calling the Onshape API

All Onshape API calls go through one of two classes defined in `src/backend/onshape-api/onshape-api.ts`:

**`OAuthApi`** — Use this for requests made on behalf of a logged-in user. It adds the user's OAuth access token as a `Bearer` header. If the token has expired, it automatically refreshes it and retries. This is the class you'll almost always use.

**`KeyApi`** — Use this for server-to-server requests that don't need a user session (e.g., background jobs that use a static API key). It signs requests with HMAC-SHA256.

Both expose the same methods: `.get()`, `.post()`, `.delete()`, `.getImage()`, etc.

In a route handler, you get an `OAuthApi` instance like this:

```ts
const onshapeApi = await c.var.getOnshapeApi();
```

Then pass it to any function in `src/backend/onshape-api/endpoints/`:

```ts
import { getDocumentElements } from "../onshape-api/endpoints/documents";

const elements = await getDocumentElements(onshapeApi, instancePath);
```

**Before writing a new wrapper function, check if it already exists** in one of the files under `src/backend/onshape-api/endpoints/`:

| File | Wraps |
|---|---|
| `documents.ts` | Document metadata, workspaces, elements, references |
| `assemblies.ts` | Assembly structure, adding elements, adding features, transforms |
| `part-studios.ts` | Part Studio features |
| `feature-studios.ts` | Feature Studio code (pull/push) |
| `configurations.ts` | Configuration definitions and encoding |
| `thumbnails.ts` | Element thumbnail images |
| `users.ts` | User info, session ping |
| `permissions.ts` | Permission checks |
| `metadata.ts` | Element/part metadata |
| `versions.ts` | Version listing |
| `settings.ts` | Document settings |

---

## Adding a New Onshape API Wrapper

Use this when you need to call an Onshape endpoint that doesn't have a wrapper yet.

### 1. Find the endpoint in Glassworks

Go to `https://cad.onshape.com/glassworks/explorer`, find the endpoint, try it with a real document, and note the path structure and response shape.

### 2. Add a wrapper function

Find the right file in `src/backend/onshape-api/endpoints/` (or create a new one if the category is new). Add a typed function:

```ts
import { OnshapeApi } from "../onshape-api";
import { ElementPath, toElementApiPath } from "../../../shared/onshape-path";
import { apiPath } from "../api-path";

/** Fetches the BOM for an assembly element. */
export function getAssemblyBom(
    client: OnshapeApi,
    elementPath: ElementPath
): Promise<any> {
    return client.get(
        apiPath("assemblies", elementPath, toElementApiPath, {
            endRoute: "bom"
        })
    );
}
```

A few notes:
- Return type `Promise<any>` is fine to start. Once you know the response shape, define an interface and use that instead.
- Use `apiPath()` to build the URL rather than constructing strings manually — it handles encoding and prefix logic for you.
- For POST calls, pass `{ body: { ... } }` as the second argument to `client.post()`.

### 3. Call it from a backend route

Import your new function in the appropriate route file and call it inside a handler (see the next section).

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

### 2. Generate the migration

```bash
npx drizzle-kit generate
```

This creates a new `.sql` file in `drizzle/`. Commit this file — it's how the schema gets applied to production D1.

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

### 4. Navigate to the new route

Use TanStack Router's `<Link>` component for navigation:

```tsx
import { Link } from "@tanstack/react-router";

<Link to="/app/settings">Go to settings</Link>
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

For actions that change data (POST, DELETE), use React Query's `useMutation`:

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";

function MyButton({ id }: { id: string }) {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: () => apiPost("/do-thing", { body: { id } }),
        onSuccess: () => {
            // Invalidate any queries whose data may have changed
            queryClient.invalidateQueries({ queryKey: ["my-data"] });
        }
    });

    return (
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Do Thing"}
        </button>
    );
}
```

---

## The `apiGet` / `apiPost` / `apiDelete` Helpers

These are thin wrappers around `fetch` defined in `src/frontend/api-utils/api.ts`. They:
- Automatically prepend `/api` to the path (so you write `"/context-data"` not `"/api/context-data"`)
- Serialize query parameters via `URLSearchParams`
- Append a `?v=` cache-busting parameter when `cacheId` is provided
- Parse the JSON response and throw a typed error if the response is not OK

You don't need to use `fetch` directly in frontend code — always use these helpers.
