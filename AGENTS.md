# Code style

## Comments

Explain _why_, not _what_: the what is in the code. Don't restate a signature
(write "returns the access level, respecting the cache", not a paragraph
re-deriving the caching), and delete comments that narrate obvious steps.

One or two lines is the usual size. Go longer only for something genuinely
hard — a protocol Onshape does not document, a fix whose reason is not visible
from the code — and then say the hard thing plainly rather than compressing it
into dense prose. **No comment is better than a long one, and a long one is
better than a short one that is wrong.** Brevity is not worth an inaccuracy.

A comment is a claim, and a reader will believe it without checking. So:

- **Don't assert an invariant nothing enforces.** "Values never carry a `;`"
  was true of the values anyone had tried and false of the ones a user could
  type; it stood above the code it was wrong about for months. If a comment
  states an invariant, either the code next to it enforces that invariant, or
  the comment names what does (a validator, a schema, a filter upstream). If
  neither is true, the comment is a bug report — fix the code instead.
- **Write what you checked, not what you assume.** "These enums share these
  values" was written about two enums that overlap on two of five members.
  Prefer "the loader filters to these two types, so a cast is safe here" —
  which a reader can go and verify — over a flat assertion they cannot.
- **Hedge where you are actually unsure.** "as far as I can tell" and "Onshape
  does not document this" are useful; they tell the next person where to look.
  Confident phrasing on a guess is worse than no comment.
- **Don't write a comment that forecloses checking.** "which is what lets this
  round-trip" and "so nothing else has to" read as settled and stop the reader
  from looking. State the reason; don't certify the conclusion.

Update the comment in the same change as the code it describes, and delete it
when it stops being true. A stale comment outranks the code in a reader's head,
which is what makes it worse than none.

## Components

A component's props are a named `interface <Component>Props` declared just above
it, never an inline object type — the name is what error messages and editors
show at the call site.

A function declared inside a component is a `const` arrow, never a `function`
declaration: the surrounding component is the hoisting boundary, and an arrow
reads as the value it is.

Every hook call is its own `const`, on its own line, before anything else the
body does — never inline in an expression, an argument, an index, or a `return`.
`return useGetUiState().vendorFilters[useLibraryId()]` works today and breaks the
day someone adds an early return above it, because the hooks stop running in the
same order every render. Read the hook, then use what it gave you:

```ts
const uiState = useGetUiState();
const libraryId = useLibraryId();
return uiState.vendorFilters[libraryId];
```

The same goes for `&&` and `?:` around a hook — `!hidden && !useShowHidden()`
short-circuits, which is a conditional call the linter will reject.

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

Anything the frontend imports from a backend feature must be a leaf module —
pure types and functions, no Worker-only imports — or it lands in the client
bundle.

D1 tables live in `db/schema.ts`, except a feature's own: tracking's are in
`features/analytics/schema.ts`, since nothing outside analytics reads them and
they hold no foreign key into the rest. `drizzle.config.ts` lists every schema
file, so a new one has to be added there or its tables generate no migration.

## Configurations

A configuration takes exactly two forms, and `features/configurations/selection.ts`
is the only place either is built:

- A **selection** (`Selection`) is what someone picked: every parameter
  the insertable declares, each value canonically spelled (base units, trimmed,
  lowercase booleans). `toSelection` makes one out of whatever arrived — a partial map
  from a search hit, a stored favorite, a request body — and every boundary
  calls it. Parameter defaults are canonical too, from `parse-configuration`, so
  nothing has to canonicalize one to compare against it.
- A **`ConfigurationKey`** is that selection's identity: what it overrides,
  encoded as `id=value;id=value`, with hidden parameters left out. It addresses
  a render — R2 keys, thumbnail urls, stored records, Onshape itself — and
  `ELEMENT_DEFAULT_KEY` (the empty string) is a selection that overrides
  nothing.

Raw text lives only inside the input a user is typing into. Don't add a third
form: if something needs a different view of a selection, it wants a function in
`selection.ts`, not a new shape.

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

- `/` — redirects to the last library used, from `localStorage`.
- `/app/library/<library-id>` — a library; ids are in `library-id.ts`.
- `/app/library/<library-id>/groups/<group-id>` — one group.

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

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

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
