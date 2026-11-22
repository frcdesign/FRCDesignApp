# Mass Analysis: strings

What [mass-analysis.md](../architecture/mass-analysis.md) shows a person. The
page's strings are messages in `src/frontend/messages/en.json`, keyed
`massAnalysis…`. A save's refusals are written by the backend
(`src/backend/features/mass-analysis/routes.ts`), and the page's toast shows
its own message in their place.

## Getting there

| String          | Kind      | Where                  | When                               | Review    |
| --------------- | --------- | ---------------------- | ---------------------------------- | --------- |
| "Mass Analysis" | Menu item | Page picker, Utilities | The panel was opened on an element | **⚑** New |

## The page

| String                                                                               | Kind                 | Where              | When                       | Review    |
| ------------------------------------------------------------------------------------ | -------------------- | ------------------ | -------------------------- | --------- |
| "Open an assembly to weigh it"                                                       | Notice title         | In place of a page | Opened outside an assembly | **⚑** New |
| "Mass Analysis shows where an assembly's mass is. Open it from an assembly's panel." | Notice description   | In place of a page | Opened outside an assembly | **⚑** New |
| "Sign in to weigh your assembly" / "Sign in"                                         | Notice title, button | In place of a page | Signed out                 | **⚑** New |
| "Mass Analysis reads your assembly's parts and their masses."                        | Notice description   | In place of a page | Signed out                 | **⚑** New |
| "Loading masses..."                                                                  | Loading              | In place of a page | The BOM is read            | **⚑** New |
| "Failed to read the assembly's masses"                                               | Error                | In place of a page | That read failed           | **⚑** New |

## The chart

| String                 | Kind                   | Where                 | When                            | Review                     |
| ---------------------- | ---------------------- | --------------------- | ------------------------------- | -------------------------- |
| "Mass" / "{mass} lb"   | Section title, caption | Top of the page       | Always; the level's total       | **⚑** New                  |
| "{mass} lb"            | Tooltip value          | Over a tile           | Hovering a tile                 | **⚑** New                  |
| "Assembly"             | Breadcrumb             | Above the chart       | A subassembly is open           | **⚑** New: the root's name |
| "No parts with a mass" | Notice title           | In place of the chart | Nothing at the level has a mass | **⚑** New                  |

## Parts without a mass

| String                               | Kind                   | Where                    | When                                         | Review                       |
| ------------------------------------ | ---------------------- | ------------------------ | -------------------------------------------- | ---------------------------- |
| "Parts without a mass" / "{n} parts" | Section title, caption | Under the chart          | Always; the caption with any listed          | **⚑** New                    |
| "Every part has a mass"              | Notice title           | In place of the list     | Nothing listed                               | **⚑** New                    |
| "×{count}"                           | Row text               | Beside a part's name     | Always: how many the level holds             | **⚑** New                    |
| "In {assembly}"                      | Row text               | Under a part's name      | The part is in a subassembly of the level    | **⚑** New                    |
| "Material"                           | Dropdown label         | A part's card            | A part that isn't a library's                | **⚑** New                    |
| "Set in the part's own document"     | Dropdown description   | Under Material, disabled | The part is in another document              | **⚑** New                    |
| "Mass (lb)"                          | Number input label     | A part's card            | A part that isn't a library's                | **⚑** New: sets the override |
| "Save"                               | Button                 | Beside Mass              | Disabled until a material or mass is entered | **⚑** New                    |
| "Library part"                       | Row text               | In place of the inputs   | A library's part                             | **⚑** New                    |
| "Failed to save the part"            | Error toast            |                          | Onshape or the server refused the save       | **⚑** New                    |
