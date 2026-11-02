# Architecture

One document per feature area, describing how it works **now**: what it owns,
where it stores things, how its flows run, and the rules that must keep holding.

**These documents are what a reviewer reviews.** The architecture is decided
here, by people: an area's purpose, contracts and types, storage, flows,
user-facing strings, invariants and decisions. The implementation is left to
Claude, held to these documents by their invariants, the tests and CI. So:

- A change to the design shows in a document's diff, in the same pull request
  as the code. Review that diff as the change.
- Read the code against the document's invariants and code map, not line by
  line: whether it does what the document says, not how it's written.
- A pull request that changes behavior with no document diff, or a document
  that no longer says what the code does, is the thing to send back.

`scripts/doc-review/build.mjs` gathers every Markdown file into one page to
read and comment on, the ones a branch changed first with their diffs; the
`review-docs` skill publishes it.

| Document                                   | Covers                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| [thumbnails.md](./thumbnails.md)           | Element, group and configuration thumbnails: rendering, R2 storage, cleanup        |
| [configurations.md](./configurations.md)   | Parameters, selections, configuration keys, indexing and enumeration               |
| [loading.md](./loading.md)                 | Loading a document into the library: jobs, the load workflow, webhooks             |
| [favorites.md](./favorites.md)             | Per-user favorites and the configuration each opens with                           |
| [recents.md](./recents.md)                 | Per-user recently inserted parts, and the configuration each was inserted with     |
| [auth.md](./auth.md)                       | Onshape OAuth, sessions, access levels, and the environment variables              |
| [search.md](./search.md)                   | Building, serving and querying each library's search index                         |
| [analytics.md](./analytics.md)             | Usage tracking, rollups, and the public dashboard                                  |
| [build-issues.md](./build-issues.md)       | Build issues, the checks that raise them, and the admin card editors fix them from |
| [version-manager.md](./version-manager.md) | Links between Onshape workspaces, and the pushes and pulls along them              |
| [platform.md](./platform.md)               | Onshape client, errors, retries and timeouts, concurrency, toasts, pushes, caching |

[REFERENCE.md](../REFERENCE.md) is the tour of the whole system and links here
for depth; [GUIDE.md](../GUIDE.md) holds recipes.

## Shape of a document

Every document uses the same sections, in this order, leaving out any that
would be empty:

1. **Purpose** — what the area is for, and what it deliberately is not.
2. **Code map** — the functions to start reading, as signatures in `ts`
   blocks grouped under the file paths they live in, in the order the area's
   main flow runs them. A one-line comment above a signature only where its
   name and types don't say what it is for. Routes are listed as method and
   path in a `text` block under their file. Below the signatures, in the block
   of the files that define them, the interfaces, types and enums they take
   and return, and those those refer to, as the code declares them, field
   comments included, so the map reads without opening the code. A type
   defined outside the listed files (a library's, Onshape's, another area's)
   is named, not copied.
3. **Storage** — every table, KV store, R2 prefix and browser store it touches,
   with lifetimes.
4. **Flows** — the paths through the code, as numbered steps. A diagram only
   where the ordering is the hard part.
5. **User-facing strings** — a link to the area's file in
   [`docs/strings/`](../strings/README.md), which lists them.
6. **Invariants** — rules that must hold, stated so a reviewer can check a diff
   against them. This is the section drift is measured by.
7. **Failure and recovery** — what goes wrong, and what puts it right.
8. **Decisions** — choices that look wrong or have a tempting alternative, each
   with its reason. New decisions are added here rather than in a separate log.

Write the way `AGENTS.md` asks of comments: what is true now, plainly, without
history or hedging. Name code by path and symbol, in backticks, so it can be
searched for.

## Keeping them current

A change that alters a flow, an invariant, a storage location, a limit, or an
environment variable updates the document in the same commit. `AGENTS.md` has
the full rules.

`npm run check:docs` fails when a document names a path under `src/`, `docs/`,
`drizzle/` or `scripts/` that no longer exists, which catches the most common
drift, a move or rename. It runs in CI.

Each document ends with a **Last reviewed** date. Bump it when you read the
whole document against the code and fix what disagrees, not for a one-line edit.
