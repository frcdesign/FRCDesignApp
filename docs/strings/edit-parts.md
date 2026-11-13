# Edit parts: strings

What [edit-parts.md](../architecture/edit-parts.md) shows a person. Messages
are keyed `editParts…` in `src/frontend/messages/en.json`. A pick's problem is
written by the backend (`edit-parts/targets.ts`) and shown as it comes.

## Picking

| String                                     | Kind             | Where                    | When                                          | Review    |
| ------------------------------------------ | ---------------- | ------------------------ | --------------------------------------------- | --------- |
| "Edit parts"                               | Button           | The context bar          | A library page in an assembly, signed in      | **⚑** New |
| "Parts to edit"                            | Query list label | Under the bar            | Edit parts open                               | **⚑** New |
| "Select library parts to edit."            | Prompt           | Onshape's message bubble | The list focused, or something else picked    | **⚑** New |
| "Part {n}"                                 | Row name         | The list's rows          | Something picked                              | **⚑** New |
| "Open this part's library to edit it."     | Note             | Under the list           | The picks are a part of another library       | **⚑** New |
| "Cancel" / "Edit"                          | Buttons          | Under the list           | Edit is disabled until the picks name a part  | **⚑** New |
| "A different part"                         | Row problem      | Under a row              | A pick isn't a copy of the first pick's part  | **⚑** New |
| "Not found in the assembly"                | Row problem      | Under a row              | A pick's instance is gone                     | **⚑** New |
| "Its configuration can't take this change" | Row problem      | Counted in the menu      | A pick's other values hide what the edit sets | **⚑** New |

## The menu

| String                                                                                                      | Kind          | Where            | When                                      | Review    |
| ----------------------------------------------------------------------------------------------------------- | ------------- | ---------------- | ----------------------------------------- | --------- |
| "Mates to these parts are deleted. Fasten them again by hand."                                              | Warning       | Top of the menu  | Always                                    | **⚑** New |
| "Apply to the 1 with the same configuration" / "Apply to all {n} with the same configuration"               | Checkbox      | Under the inputs | More copies match than were picked        | **⚑** New |
| "1 pick can't take this change and is left alone." / "{n} picks can't take this change and are left alone." | Warning       | Under the inputs | The check marks picks against the changes | **⚑** New |
| "Update"                                                                                                    | Button        | Footer           | Disabled until something changes          |           |
| "Updating {name}..."                                                                                        | Loading toast |                  | While the run goes                        | **⚑** New |
| "Updated 1 part." / "Updated {n} parts."                                                                    | Success toast |                  | The run finished                          | **⚑** New |
| "Unexpectedly failed to update {name}."                                                                     | Error toast   |                  | The run failed without a worded reason    | **⚑** New |
| "Not a library part" / "No part can take this change"                                                       | Error toast   |                  | The run refuses: written by the route     | **⚑** New |
