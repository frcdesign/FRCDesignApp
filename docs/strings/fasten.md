# Insert and fasten: strings

What [fasten.md](../architecture/fasten.md) shows a person. The card's, the
toasts' and the tip's strings are messages in `src/frontend/messages/en.json`,
keyed `fasten…` (an insert's own toasts, `insert…`). The errors are written by
the backend (`library/insertables/routes.ts`, and the check route Auto
Assembly shares), and the app shows them as they come.

## The card

The cursor icon's card, in the navbar and the insert menu.

| String                                                                       | Kind             | Where                    | When                                               | Review                             |
| ---------------------------------------------------------------------------- | ---------------- | ------------------------ | -------------------------------------------------- | ---------------------------------- |
| "{n} circular edge(s) selected" / "{n} face(s) selected"                     | Card title       | Top                      | Something picked                                   |                                    |
| "No circular edges selected" / "No faces selected"                           | Card title       | Top                      | Nothing picked                                     |                                    |
| "Select edges to automatically fasten inserted parts to."                    | Card description | Under the title          | Circular edges, nothing picked                     |                                    |
| "The part will be fastened to the selected edge."                            | Card description | Under the title          | One edge picked                                    |                                    |
| "A part will be inserted and fastened to each selected edge."                | Card description | Under the title          | Several edges picked                               |                                    |
| "Select faces to automatically fasten inserted parts to every hole in them." | Card description | Under the title          | Faces, nothing picked                              |                                    |
| "A part will be inserted and fastened to every hole in the selected faces."  | Card description | Under the title          | Faces picked                                       |                                    |
| "Circular edges" / "Faces"                                                   | Mode, list label | The switch, first list   | Always                                             |                                    |
| "Edges to exclude"                                                           | Query list label | Second list              | Faces                                              | **⚑** Was "Holes to skip"          |
| "Select circular edges to fasten parts to."                                  | Prompt           | Onshape's message bubble | Circular edges focused, or something else picked   |                                    |
| "Select faces to fasten parts to every hole in."                             | Prompt           | Onshape's message bubble | Faces focused, or something else picked            |                                    |
| "Select circular edges to exclude."                                          | Prompt           | Onshape's message bubble | Edges to exclude focused, or something else picked | **⚑** Reworded, as Auto Assembly's |

A row's problem under it is the check's, listed in
[auto-assembly.md](./auto-assembly.md#a-picks-problem).

## Toasts

| String                                                                                                            | Kind          | When                                                       | Review |
| ----------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------- | ------ |
| "Successfully inserted {name} and fastened it to {n} circular edge(s)."                                           | Success toast | Inserted and fastened to picks                             |        |
| "Successfully inserted {name} and created a Fasten mate."                                                         | Success toast | Inserted into an assembly with nothing picked              |        |
| "Successfully inserted {name}."                                                                                   | Success toast | Inserted, not into an assembly                             |        |
| "Unexpectedly failed to insert {name}."                                                                           | Error toast   | The insert request failed                                  |        |
| "Tip: You can select circular edges in Onshape before you insert and fasten to automatically fasten to each one." | Tip toast     | Insert and fasten with nothing picked, at most three times |        |

## Errors

| String                                               | Kind                | When                           | Review |
| ---------------------------------------------------- | ------------------- | ------------------------------ | ------ |
| "No circular edges were found in what was selected." | Error, insert route | Picks with no circular edge    |        |
| "Select only what Select by asks for."               | Error, insert route | Picks the mode doesn't ask for |        |
| "{name} does not support insert and fasten."         | Error, insert route | A part with no fasten info     |        |
