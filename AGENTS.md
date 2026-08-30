# Code style

## Comments

Keep comments short. Prefer one line, with two lines as an absolute maximum.
Explain _why_ something is done, not _what_ the code does — the what
should be inferable from the code. Don't restate a function's behavior in its
doc comment when the signature already says it (e.g. write "returns the access
level, respecting the cache" — not a paragraph re-deriving the caching).
Aggressively delete comments that narrate obvious implementation details.

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

# Running the app

Onshape launches the app at `/init`, which needs a real Onshape session and
https. Standalone mode is the same SPA without either, and is how to drive the
app locally — including headless. Don't build a stub server for the API; run the
real one.

Put this in `.env` (git-ignored). It is the whole set needed to get a signed-in
admin; the OAuth keys in the README are only for talking to Onshape itself:

```
FORCE_SIGNED_IN=true            # a fake user, so no OAuth round trip
ACCESS_LEVEL_OVERRIDE=admin     # what the server grants
VITE_DEFAULT_ACCESS_LEVEL=admin # what the client renders as
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
