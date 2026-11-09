# Auto Assembly: strings

What [auto-assembly.md](../architecture/auto-assembly.md) shows a person. The
page's own strings are messages in `src/frontend/messages/en.json`, keyed
`autoAssembly…`. A pick's and a hole's problems, and a run's failures, are
written by the backend (`planner.ts`, `check.ts`, `index-holes.ts`,
`failures.ts`, `workflow.ts`, `routes.ts`) with the values they name, and the
page shows them as they come.

## The page

| String                                                                                                                      | Kind                      | Where              | When                               | Review |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------ | ---------------------------------- | ------ |
| "Open an assembly to fasten parts"                                                                                          | Notice title              | In place of a page | Opened outside an assembly         |        |
| "Auto Assembly puts screws, washers and nuts in the holes of an assembly's parts. Open it from an assembly's panel."        | Notice description        | In place of a page | Opened outside an assembly         |        |
| "Sign in to fasten parts" / "Sign in"                                                                                       | Notice title, button      | In place of a page | Signed out                         |        |
| "Auto Assembly reads your assembly's holes and inserts fasteners into it."                                                  | Notice description        | In place of a page | Signed out                         |        |
| "Loading fasteners..."                                                                                                      | Loading                   | In place of a form | The loaded fasteners are read      |        |
| "Couldn't load the fasteners."                                                                                              | Error                     | In place of a form | That read failed                   |        |
| "No fasteners are loaded yet." / "Auto Assembly uses the fasteners in FRCDesignLib's Fasteners group, once they're loaded." | Notice title, description | In place of a form | The library hasn't loaded them yet |        |

## The form

| String                                                                | Kind                   | Where                                 | When                                                           | Review                        |
| --------------------------------------------------------------------- | ---------------------- | ------------------------------------- | -------------------------------------------------------------- | ----------------------------- |
| "Fastener"                                                            | Section title          | First group                           | Always                                                         |                               |
| "Program" / "FRC" / "FTC"                                             | Dropdown, options      | Fastener group                        | Always                                                         |                               |
| "FTC fasteners aren't available yet."                                 | Note                   | In place of the Fastener group's rows | FTC chosen                                                     | **⚑** FTC's are now released  |
| "Sizing" / "Automatic" / "Manual"                                     | Dropdown, options      | Fastener group                        | Always                                                         |                               |
| "Add screw washer" / "Add nut" / "Add nut washer"                     | Group titles, checkbox | Under the Fastener group              | Screw washer not under a flat head; nut washer only with a nut |                               |
| "Stop condition" / "All holes" / "First gap"                          | Dropdown, options      | Last group                            | Automatic sizing                                               |                               |
| "Limit screw length"                                                  | Checkbox               | Last group                            | Automatic sizing                                               |                               |
| "Max length" / "Max gap to ignore" / "Max thread depth"               | Length inputs          | Last group                            | Automatic sizing; Max gap with First gap                       |                               |
| "Selections"                                                          | Section title          | Last                                  | Always                                                         |                               |
| "Select by" / "Circular edges" / "Faces" / "Screws"                   | Dropdown, options      | Selections                            | Always                                                         |                               |
| "Faces" / "Edges to exclude" / "Circular edges" / "Screws to replace" | Query list labels      | Selections                            | As Select by says: Faces shows Edges to exclude                | **⚑** Edges to exclude is new |
| "Select faces to use."                                                | Prompt                 | Onshape's message bubble              | Faces focused, or something else picked                        | **⚑** Reworded                |
| "Select circular edges to exclude."                                   | Prompt                 | Onshape's message bubble              | Edges to exclude focused, or something else picked             | **⚑** Reworded                |
| "Select the circular edges of holes to use."                          | Prompt                 | Onshape's message bubble              | Circular edges focused, or something else picked               | **⚑** Reworded                |
| "Select screws to replace."                                           | Prompt                 | Onshape's message bubble              | Screws to replace focused, or something else picked            | **⚑** Reworded                |
| "Edge {n}" / "Face {n}" / "Screw {n}"                                 | Row names              | A list's rows, and the run's picks    | Something picked                                               |                               |
| "Insert"                                                              | Button                 | Under the form                        | Always; disabled with nothing picked                           |                               |
| "Unexpectedly failed to start inserting."                             | Error toast            |                                       | The insert request failed                                      |                               |

## A run

| String                                                                                              | Kind                         | Where                          | When                                                                       | Review                          |
| --------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------ | -------------------------------------------------------------------------- | ------------------------------- |
| "Inserting fasteners..."                                                                            | Loading toast, title         | Toast, details title           | A watched run starts                                                       |                                 |
| "Indexing holes..." / "Removing replaced parts..." / "Inserting parts..." / "Fastening parts..."    | Status                       | Details title, callout         | That step is going                                                         |                                 |
| "{step} You can leave this page."                                                                   | Callout                      | Above the form                 | A run is going                                                             |                                 |
| "Inserted {n} part(s)" / "Inserted {n} part(s), replacing {m} screw(s)"                             | Headline                     | Callout, toast, details title  | Finished with no problem                                                   |                                 |
| "Inserted {n} part(s) with problems" / "Inserted {n} part(s), replacing {m} screw(s) with problems" | Headline                     | Callout, toast, details title  | Finished, with a hole's error or warning, a part unmated, or a step failed | **⚑** Now also a hole's warning |
| "Couldn't insert fasteners"                                                                         | Headline                     | Callout, toast, details title  | Nothing inserted                                                           |                                 |
| "{headline} {time ago}." / "{headline}."                                                            | Callout, toast               |                                | Finished                                                                   |                                 |
| "Details"                                                                                           | Button                       | Callout, the finished toast    | A run is going or finished                                                 |                                 |
| "No recent run"                                                                                     | Details title                | Details                        | No run kept for this assembly                                              |                                 |
| "Stopped early."                                                                                    | Notice title, with the error | Details                        | The run stopped                                                            |                                 |
| "Index holes" / "Remove replaced parts" / "Insert parts" / "Fasten parts"                           | Step names                   | Details                        | Always                                                                     |                                 |
| "{n} pick(s) has/have problems."                                                                    | Step warning                 | Under Index holes, in Details  | A pick has an error or a warning                                           | **⚑** New                       |
| "{n} of {m} parts weren't fastened, so they sit unmated."                                           | Step warning                 | Under Fasten parts, in Details | Fewer parts fastened than inserted                                         | **⚑** New                       |
| "Faces" / "Circular edges" / "Edges to exclude" / "Screws to replace"                               | Group labels                 | Details, under the steps       | The run had picks in that list                                             | **⚑** New                       |

## A pick's problem

Under a row, in red for an error and yellow for a warning: in the form as the
picks are checked, and in the run's details for the picks it was given.

| String                                                                        | Severity | When                                                 | Review    |
| ----------------------------------------------------------------------------- | -------- | ---------------------------------------------------- | --------- |
| "Couldn't find this part in the assembly."                                    | Error    | A pick's part is gone                                |           |
| "Not a circular edge."                                                        | Error    | A circular edge pick that isn't one                  |           |
| "No circular edges in this face."                                             | Error    | A face with no holes                                 |           |
| "A library screw is already in this hole. Select it by Screws to replace it." | Error    | The hole already has a library screw                 |           |
| "{n} of {m} holes can't be fastened: {why}"                                   | Error    | Some of a face's holes have an error                 |           |
| "{n} of {m} holes have a warning: {why}"                                      | Warning  | Some of a face's holes have a warning, none an error | **⚑** New |
| "Not a hole in the faces picked."                                             | Error    | A hole to skip outside the faces picked              |           |
| "Its hole can't be fastened again, so it stays: {why}"                        | Error    | A screw to replace whose hole has an error           |           |
| "Not a screw from FRCDesignLib's Fasteners group."                            | Error    | A screw to replace that isn't the library's          |           |
| "This screw is in a subassembly, which Auto Assembly doesn't change."         | Error    | A screw to replace in a subassembly                  |           |
| "Couldn't find the hole this screw is in."                                    | Error    | A screw to replace on no hole                        |           |
| "This hole can't be fastened."                                                | Error    | A hole with an error and no reason                   |           |

A hole's own problem, written by the planner, follows. A preset length names
itself, "The {length} screw"; automatic, the length it chose.

| String                                                                                                                         | Severity | When                                                          | Review                        |
| ------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------- | ----------------------------- |
| "The head isn't made in this size."                                                                                            | Error    | The head has no dimensions in the size                        |                               |
| "No hole goes into the part from this circular edge."                                                                          | Error    | Nothing under the circular edge                               |                               |
| "The hole is too small for a {size} screw."                                                                                    | Error    | The hole is narrower than the screw                           |                               |
| "The vendor doesn't make this head in this size."                                                                              | Error    | No lengths in the size, head and finish                       |                               |
| "The vendor doesn't make this length in this size and head."                                                                   | Error    | A preset length the vendor doesn't make                       |                               |
| "No screw is made within the maximum length."                                                                                  | Error    | Every length is over the maximum length                       | **⚑** New                     |
| "The longest screw[ within the maximum length], {length}, is {distance} too short to reach through the nut." / "...the parts." | Error    | Out the far side, no length reaches                           | **⚑** New, names the length   |
| "The {length} screw is {distance} too short to reach through the nut." / "...the parts."                                       | Error    | Out the far side, a preset length doesn't reach               | **⚑** New: was inserted short |
| "The closest screw, {length}, is {distance} too long, so it bottoms out in the hole."                                          | Warning  | Into a hole with a bottom, every length goes too deep         | **⚑** New                     |
| "The closest screw, {length}, goes {distance} past the maximum thread depth."                                                  | Warning  | Into threads, every length goes past the maximum thread depth | **⚑** New                     |
| "The closest screw, {length}, is {distance} too short: it goes only {distance} into the threads."                              | Warning  | Into threads, no length engages a diameter of thread          | **⚑** New                     |
| "The closest screw, {length}, is {distance} too short: it goes only {distance} into the hole."                                 | Warning  | Into a blind hole, likewise                                   | **⚑** New                     |
| "No edge on the far side to fasten a nut to, so it gets no nut."                                                               | Warning  | Out the far side, but no edge there                           | **⚑** Reworded, now a warning |

## A run's failures

| String                                                                      | Kind                | When                                    | Review                       |
| --------------------------------------------------------------------------- | ------------------- | --------------------------------------- | ---------------------------- |
| "Auto Assembly stopped: {why}"                                              | The run's error     | The run stopped                         |                              |
| "Couldn't read the assembly's holes."                                       | A step's failure    | Index failed                            |                              |
| "Couldn't remove the screws to replace."                                    | A step's failure    | Remove failed                           |                              |
| "Couldn't insert the fasteners."                                            | A step's failure    | Insert failed                           |                              |
| "Couldn't fasten the inserted parts."                                       | A step's failure    | Fasten failed                           |                              |
| "You don't have permission to edit this assembly."                          | A step's failure    | Onshape answered 403                    |                              |
| "A fastener's studio has no mate connector to fasten by. Reload its group." | Fasten step failure | A studio's load found no mate connector |                              |
| "The run stopped unexpectedly."                                             | The run's error     | The workflow ended without reporting    |                              |
| "Auto Assembly's parts aren't published yet."                               | Error, insert route | No fasteners loaded                     |                              |
| "Auto Assembly doesn't have FTC fasteners yet."                             | Error, insert route | FTC chosen                              | **⚑** FTC's are now released |
| "Fasteners are already being inserted in this assembly."                    | Error, insert route | A run is going                          |                              |
| "Select holes to fasten or screws to replace."                              | Error, insert route | Nothing picked                          |                              |
| "Select only what Select by asks for."                                      | Error, insert route | Picks Select by doesn't ask for         |                              |
| "Every part must be one its vendor makes, in the screw's size."             | Error, insert route | A part the catalog doesn't make         |                              |
| "A nut washer goes under a nut."                                            | Error, insert route | A nut washer without a nut              |                              |
