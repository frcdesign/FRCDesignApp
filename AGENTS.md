# Code style

## Comments

Default to none. A good name and type say what a thing is; a comment is for the
_why_ a reader cannot get from the code: a workaround, a constraint from
Onshape or Cloudflare, a choice that looks wrong but isn't.

Keep it to one line, two at most. If it needs more, the code probably wants
restructuring or the detail belongs in the commit message. The exception is a
genuinely obscure protocol, and even then aim for a short paragraph.

Write it plainly and with confidence:

- **Say what is true now.** No history ("used to", "no longer", "was moved
  here"), and no alternatives you didn't take ("rather than X"). Those go in
  the commit message.
- **Don't hedge.** If you are unsure, check — read the docs, run it, write a
  test — then state the result. Leave uncertainty in only where it cannot be
  checked, such as undocumented Onshape behavior, and say so in a few words.
- **Don't restate the code.** No narrating steps, re-deriving a signature, or
  listing every caller.

Update or delete a comment in the same change as the code it describes: a
stale comment is worse than none.

## Absent values

Prefer `undefined` to `null` for a value that is not there: an optional field
(`name?: string`), a function that finds nothing, an unset state. Where a
boundary hands us `null` — a D1 column, KV's `get`, a DOM API, an Onshape
response — convert it where it enters (`?? undefined`) rather than carrying it
inward.

`null` stays only where it has to:

- the boundary's own shape: a Drizzle column type, a row straight from a query;
- where `undefined` cannot go: a TanStack Query result, a Workflow step's
  result, a JSON field that must be sent to say "clear this";
- where it means something `undefined` cannot, next to it: `null` for "none at
  all" beside `undefined` for "the default".

## Components

A component's props are a named `interface <Component>Props` declared just above
it, never an inline object type — the name is what error messages and editors
show at the call site.

A function declared inside a component is a `const` arrow, never a `function`
declaration.

Keep hook calls where the next person will see them: at the top of the body,
one per `const`.

This is fine — the hook is the first and only thing the function does:

```ts
function useIsDashboard(): boolean {
    return useMatch({ from: "/dashboard", shouldThrow: false }) !== undefined;
}
```

## Layout

`src/` has two sides, `backend/` (the Worker) and `frontend/` (the SPA). There
is no shared directory: the backend owns the contract, and the frontend imports
it through the `@backend/*` alias. Imports within a side stay relative.

Both sides are organized the same way:

- `features/<feature>/` — everything one feature owns. Backend features hold
  `routes.ts` plus their storage, models and DTOs; frontend features hold
  `queries.ts` and `components/`.
- `lib/` — cross-cutting plumbing that belongs to no single feature.
- `components/` (frontend only) — UI used by more than one feature.

Anything the frontend imports from a backend feature should be a leaf module —
pure types and functions, no Worker-only imports — or it lands in the client
bundle.

D1 tables live in `db/schema.ts`, except a feature's own: tracking's are in
`features/analytics/schema.ts`, since nothing outside analytics reads them and
they hold no foreign key into the rest. `drizzle.config.ts` lists every schema
file, so a new one has to be added there or its tables generate no migration.

## Configurations

A configuration takes exactly two forms, and `features/configurations/selection.ts`
is the only place either is built:

- A **selection** (`Selection`) is what someone picked: every parameter the
  insertable declares, each value **as it was entered**. A quantity is the
  expression that was typed — `(2 + 3) in`, not `0.127 m` — and a quantity's
  default is spelled in its own unit (`1 in`). `toSelection` makes one out of
  whatever arrived — a search hit's values, a stored favorite, a request body,
  the url — and every boundary calls it. The selection is what is stored, what
  the url carries, and what Onshape is sent (`onshapeOverrides`), so a derived
  feature shows the expression that was typed.
- A **`ConfigurationKey`** is derived from a selection for one purpose: naming
  its thumbnail. It holds what the selection overrides, canonically spelled
  (base units, hidden parameters left out), so selections rendering the same
  part share a render. `DEFAULT_CONFIGURATION_KEY` (the empty string) overrides
  nothing. Never store a key in place of the selection it came from, and never
  send one to Onshape as a configuration outside thumbnails.

Anything that needs values compared or counted — analytics, "is this the
default" — goes through `canonicalValue`/`canonicalValues`, never through a key.
Don't add a third form: if something needs a different view of a selection, it
wants a function in `selection.ts`, not a new shape.

# Tests

`npm test` runs two Vitest projects. A backend test that needs bindings (D1,
R2, KV, Workflows) is named `*.worker.test.ts` and runs in the Workers runtime
against a freshly migrated D1; that setup costs far more than most tests, so
everything else — pure backend logic and the frontend — runs in Node.

Component tests are `*.test.tsx` and run in jsdom (the `dom` project).
`renderWithProviders` in `__test_utils__/render.tsx` renders the way the app
does, with a query cache that never fetches: seed what a component reads with
`setQueryData`. Test what a person does and sees — type, click, read the
screen — rather than a component's internals.

# Running the app

Onshape launches the app at `/init`, which needs a real Onshape session and
https. Standalone mode is the same SPA without either, and is how to drive the
app locally — including headless. Don't build a stub server for the API; run the
real one.

Put this in `.env` (git-ignored). It is the whole set needed to get a signed-in
admin; the OAuth keys in the README are only for talking to Onshape itself:

```
FORCE_SIGNED_IN=true             # a fake user, so no OAuth round trip
VITE_ACCESS_LEVEL_OVERRIDE=admin # granted by the server, and viewed by the client
```

Then `npm run dev` (applies local D1 migrations, then serves
http://localhost:3000). The dev server goes https only when `localhost-key.pem`
and `localhost.pem` are present, so leave them out for a headless browser.

The test Worker ignores `.env` (`vitest.config.ts` turns that off), so leaving
one in place does not rewrite what the auth tests assert.

Where to point it:

- `/` — redirects to the last tab used, from `localStorage`.
- `/app/library/<library-id>` — a library; ids are in `library-id.ts`.
- `/app/library/<library-id>/groups/<group-id>` — one group.
- `/app/<utility-id>` — a tab that is not a library, from `app-tab.ts`;
  `getTabPath` is what turns either kind into its path.

Insert and derive key off a full element path in the search params, which is
what `useIsConnectedToOnshape` tests, so standalone hides them. Append what
Onshape would send to exercise that UI:
`?elementType=PARTSTUDIO&documentId=…&instanceType=w&instanceId=…&elementId=…`

Local D1 starts empty, so a library renders "No groups found". Import a cert
dump rather than reloading from Onshape, which spends the account's API
allocation:

```
npx wrangler d1 execute DB --local --file=<cert-dump>.sql
```

# Cloudflare Workers

Beware your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

## Commands

| Command               | Purpose                   |
| --------------------- | ------------------------- |
| `npx wrangler dev`    | Local development         |
| `npx wrangler deploy` | Deploy to Cloudflare      |
| `npx wrangler types`  | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/
