# Mass Analysis: strings

What [mass-analysis.md](../architecture/mass-analysis.md) shows a person. The
page's strings are messages in `src/frontend/messages/en.json`, keyed
`massAnalysis…`. Part and subassembly names are Onshape's.

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

| String                     | Kind                   | Where                 | When                                    | Review                     |
| -------------------------- | ---------------------- | --------------------- | --------------------------------------- | -------------------------- |
| "Mass" / "{mass} {unit}"   | Section title, caption | Top of the page       | Always; the level's total               | **⚑** New                  |
| "{mass} {unit} ({share}%)" | Tooltip value          | Over a tile           | Hovering a tile: its share of the level | **⚑** New                  |
| "Assembly"                 | Breadcrumb             | Above the chart       | A subassembly is open                   | **⚑** New: the root's name |
| "No parts with a mass"     | Notice title           | In place of the chart | Nothing at the level has a mass         | **⚑** New                  |

## Parts without a mass

| String                               | Kind                   | Where                | When                                                              | Review    |
| ------------------------------------ | ---------------------- | -------------------- | ----------------------------------------------------------------- | --------- |
| "Parts without a mass" / "{n} parts" | Section title, caption | Under the chart      | Always; the caption with any listed                               | **⚑** New |
| "Every part has a mass"              | Notice title           | In place of the list | Nothing listed                                                    | **⚑** New |
| "×{count}"                           | Row text               | End of a part's row  | Always: how many the level holds                                  | **⚑** New |
| "{assembly}"                         | Row text               | Under a part's name  | The part is in a subassembly of the level: its name, from Onshape | **⚑** New |
