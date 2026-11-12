# Insert and fasten: strings

What [fasten.md](../architecture/fasten.md) shows a person. The picking, the
toasts' and the tip's strings are messages in `src/frontend/messages/en.json`,
keyed `fasten…`, `placement…` and `contextBar…` (an insert's own toasts, `insert…`). The errors are written by
the backend (`library/insertables/routes.ts`, and the check route Auto
Assembly shares), and the app shows them as they come.

## Picking

In the insert menu's Fasten accordion, and under the context bar's
Preselection button.

| String                                                                       | Kind               | Where                            | When                                                       | Review    |
| ---------------------------------------------------------------------------- | ------------------ | -------------------------------- | ---------------------------------------------------------- | --------- |
| "Fasten"                                                                     | Accordion title    | The insert menu, with a checkbox | A part that can fasten, in an assembly                     | **⚑** New |
| "Preselection"                                                               | Button             | The context bar                  | A library page in an assembly, signed in; counts the picks | **⚑** New |
| "Add insert location"                                                        | Button             | The context bar                  | The assembly has none                                      | **⚑** New |
| "Cancel" / "Done"                                                            | Buttons            | Under the bar's lists            | Preselection open: Cancel also clears the picks            | **⚑** New |
| "Select by"                                                                  | Input label        | Over the lists                   | Always                                                     | **⚑** New |
| "Select edges to automatically fasten inserted parts to."                    | Description        | Under the lists                  | Circular edges, nothing picked                             |           |
| "The part will be fastened to the selected edge."                            | Description        | Under the lists                  | One edge picked                                            |           |
| "A part will be inserted and fastened to each selected edge."                | Description        | Under the lists                  | Several edges picked                                       |           |
| "Select faces to automatically fasten inserted parts to every hole in them." | Description        | Under the lists                  | Faces, nothing picked                                      |           |
| "A part will be inserted and fastened to every hole in the selected faces."  | Description        | Under the lists                  | Faces picked                                               |           |
| "Circular edges" / "Faces"                                                   | Option, list label | Select by, first list            | Always                                                     |           |
| "Edges to exclude"                                                           | Query list label   | Second list                      | Faces                                                      |           |
| "Select circular edges to fasten parts to."                                  | Prompt             | Onshape's message bubble         | Circular edges focused, or something else picked           |           |
| "Select faces to fasten parts to every hole in."                             | Prompt             | Onshape's message bubble         | Faces focused, or something else picked                    |           |
| "Select circular edges to exclude."                                          | Prompt             | Onshape's message bubble         | Edges to exclude focused, or something else picked         |           |

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
