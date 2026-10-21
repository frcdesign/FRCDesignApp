# Insert and fasten

## Purpose

Inserting a part into an assembly can also mate it in place: a fasten mate from
the part's own mate connector to either nothing yet, for the user to finish in
the mate dialog, or to circles the user picked in the Onshape window, which
Onshape calls preselections. Part studios derive instead and are not fastened.

## Code map

| Path                                                                | Role                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/backend/features/load/parse-fasten.ts`                         | Finds the mate connector an insertable fastens by                        |
| `src/backend/features/library/insertables/fasten-query.ts`          | Turns that connector into a query on the inserted instance               |
| `src/backend/features/library/insertables/fasten-circles.ts`        | Fastens to picked circles: one instance per circle, or a Replicate       |
| `src/backend/features/library/insertables/routes.ts`                | `POST /add-to-assembly`, which inserts and then fastens                  |
| `src/backend/lib/onshape/objects/assembly-features.ts`              | Mate, implicit mate connector and Replicate payloads                     |
| `src/frontend/lib/onshape-selection.ts`                             | What is selected in the Onshape window                                   |
| `src/frontend/lib/messages.ts`                                      | Takes Onshape's selection messages; sends selection requests and bubbles |
| `src/frontend/features/insert/circle-selection.ts`                  | The selected circles, and the request that limits picks to circles       |
| `src/frontend/features/insert/components/fasten-circles-status.tsx` | The circles icon, its card, the selection field and Replicate checkbox   |
| `src/frontend/features/insert/queries.ts`                           | `useInsertMutation`, which sends the circles with a fasten               |
| `src/frontend/features/insert/insert-tips.ts`                       | The tip pointing out circles to an insert and fasten without any         |

## Storage

- **D1** `insertables.supports_fasten` and `fasten_info` (`FastenInfo`): set
  by a load or the toggle, cleared when fasten is turned off.
- **KV** `seen-hints:` — `Hint.FASTENED_TO_CIRCLES`, once the user has fastened
  to circles; see [auth.md](./auth.md).
- **Memory** `useOnshapeSelection` — the latest selection Onshape reported, for
  this page load only.
- **localStorage** (`ui-state`): `fasten`, `replicate`, and
  `fastenCirclesTipCount`.

## Flows

### Tracking the selection

1. Once the app sends `applicationInit`, Onshape posts a message carrying the
   whole selection each time it changes. `useMessageListener` takes any message
   from the launch's server with a `selections` array as the new selection.
2. `useSelectedCircles` keeps the edges among them. Onshape's unprompted reports
   don't say an edge's geometry, so a straight edge counts until the mate fails
   on it.

### Picking circles

1. With **Fasten** ticked in an assembly, the insert menu shows the circles
   icon beside the insert location's. Its card lists the selected circles, and
   warns past `MAX_FASTEN_CIRCLES`.
2. Clicking the field sets `isSelecting`. `useCircleSelectionRequest`, mounted
   with the icon rather than the card, shows "Select circles to use." in Onshape
   and sends an unbounded `requestSelection` limited to circles.
3. The card closes as the pointer leaves for Onshape, but the request holds,
   and the icon turns the primary colour to show it. A click anywhere in the app
   outside the field, closing the menu, or unticking Fasten sends
   `stopRequest`.

### Inserting

1. `useInsertMutation` reads the selected circles and the Replicate preference
   at the click, and sends them with `fasten` to `POST /add-to-assembly`.
2. The route inserts the part at the insert location, then:
    - **No circles**: adds a fasten mate naming only the part's connector, and
      answers its `featureId`; the client opens the mate dialog to finish it.
    - **Circles**: `fastenToCircles` mates the inserted instance to the first
      circle. Each mate is the part's connector followed by an implicit connector
      the mate owns, at the circle's centre, so the circle's part stays put.
      With Replicate ticked and more than one circle, it adds a Replicate of that
      instance onto the rest; otherwise, or if the Replicate fails, it inserts
      and mates one more instance per remaining circle, serially. It answers
      `fastenedCount` and records `Hint.FASTENED_TO_CIRCLES`.
3. On `fastenedCount` the client clears the selection, since the circles are
   used; Onshape's next selection message restores whatever it still has
   selected.
4. An insert and fasten with no circles shows the circles tip, unless the quick
   insert tip showed, at most three times and never after the hint is seen.

## Invariants

- The insert is recorded exactly once per request, with `fasten` true only once
  every mate and the Replicate are built.
- A selection id is spliced into a FeatureScript query, so the route refuses
  one with a quote or backslash.
- Mates and inserts are added one at a time: Onshape rejects a feature-list edit
  that races another.
- A Replicate Onshape refuses or adds broken leaves nothing behind: one that
  fails to regenerate is deleted before the fallback runs.
- At most `MAX_FASTEN_CIRCLES` circles per insert, since each costs an insert
  and a mate without a Replicate.

## Failure and recovery

- **A mate fails**: the request errors, and whatever was inserted before it
  stays in the assembly, as in the Onshape UI.
- **A Replicate fails**: logged, deleted if it was added, and replaced by one
  instance per circle. A rate limit is rethrown instead, since the fallback
  would spend more of the same allocation.
- **A circle isn't one**: an edge picked before the field was active may be
  straight, which has no centre for the implicit connector, so its mate fails
  as any other does.

## Decisions

- **Mirror Onshape's selection rather than edit it.** Each selection message is
  the whole selection, so a circle removed only in the app would return with the
  next click. The field lists circles; deselecting happens in Onshape.
- **Replicate is guessed.** Onshape's feature specs omit Replicate, so the
  parameter ids in `replicateFeature` are unverified; the per-circle fallback
  keeps the insert correct either way. Replicate is off by default for that
  reason.
- **Implicit connector ids.** A mate names its implicit connector by a
  placeholder id that Onshape replaces on creation, which is undocumented.

_Last reviewed: 2026-10-21_
