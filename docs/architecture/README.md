# Architecture

One document per feature area, describing how it works **now**: what it owns,
where it stores things, how its flows run, and the rules that must keep holding.
They are the reference for reviewing a change against the design, and for
noticing when the code has drifted from it.

| Document                                 | Covers                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| [thumbnails.md](./thumbnails.md)         | Element, group and configuration thumbnails: rendering, R2 storage, cleanup |
| [configurations.md](./configurations.md) | Parameters, selections, configuration keys, indexing and enumeration        |
| [loading.md](./loading.md)               | Loading a document into the library: jobs, the load workflow, webhooks      |
| [favorites.md](./favorites.md)           | Per-user favorites and the configuration each opens with                    |
| [auth.md](./auth.md)                     | Onshape OAuth, sessions, access levels, and the environment variables       |
| [search.md](./search.md)                 | Building, serving and querying each library's search index                  |
| [analytics.md](./analytics.md)           | Usage tracking, rollups, and the public dashboard                           |

[REFERENCE.md](../REFERENCE.md) is the tour of the whole system and links here
for depth; [GUIDE.md](../GUIDE.md) holds recipes.

## Shape of a document

Every document uses the same sections, in this order, leaving out any that
would be empty:

1. **Purpose** — what the area is for, and what it deliberately is not.
2. **Code map** — the files that own it, each with one line on its role.
3. **Storage** — every table, KV store, R2 prefix and browser store it touches,
   with lifetimes.
4. **Flows** — the paths through the code, as numbered steps. A diagram only
   where the ordering is the hard part.
5. **Invariants** — rules that must hold, stated so a reviewer can check a diff
   against them. This is the section drift is measured by.
6. **Failure and recovery** — what goes wrong, and what puts it right.
7. **Decisions** — choices that look wrong or have a tempting alternative, each
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
