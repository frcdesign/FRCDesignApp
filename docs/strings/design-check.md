# Design check: strings

What [design-check.md](../architecture/design-check.md) shows a person checking
their own document. Every string is a message in `src/frontend/messages/en.json`,
keyed `designCheck…`.

## The checks

In each tab, one tinted box per issue type, worst first. The name is its heading, the help
sits under it, and the feature, part or instance names it was found on are
listed below that.

| Name                                       | Help                                                                                                          | Severity | Raised when                                                                                                                  | Review                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| "Under-defined sketch"                     | "Add constraints or dimensions until every line is black."                                                    | Warning  | Onshape reports an unsuppressed sketch under-defined                                                                         | **⚑** New                   |
| "Over-defined sketch"                      | "Remove the constraint or dimension that conflicts."                                                          | Error    | Onshape reports an unsuppressed sketch over-defined                                                                          | **⚑** New                   |
| "No Origin Cube"                           | "Insert the Origin Cube as the first feature, so assemblies have something to fasten to."                     | Warning  | A Part Studio, not a derived mirror's, has no Origin Cube                                                                    | **⚑** New                   |
| "Origin Cube isn't first"                  | "It's feature {position}. Drag it to the top of the list."                                                    | Warning  | The Origin Cube is below the first feature                                                                                   | **⚑** New                   |
| "Origin Cube is suppressed"                | "Unsuppress it: assemblies fasten to it."                                                                     | Warning  | The Origin Cube is suppressed                                                                                                | **⚑** New                   |
| "Origin Cube isn't fastened to the origin" | "Fasten it to the assembly origin, so everything else can fasten to it."                                      | Warning  | An Assembly's Origin Cube has no fasten to the origin                                                                        | **⚑** New                   |
| "Feature with an error"                    | "Open it to see what failed."                                                                                 | Error    | A feature or mate is red                                                                                                     | **⚑** New; also names mates |
| "Feature with a warning"                   | "Open it to see what Onshape is warning about."                                                               | Warning  | A feature or mate is yellow, or a feature lost a pick                                                                        | **⚑** New; also names mates |
| "Suppressed feature"                       | "Delete it if it's no longer needed."                                                                         | Info     | A feature or mate is suppressed                                                                                              | **⚑** New                   |
| "Inactive feature"                         | "Something it needs is suppressed, so it does nothing. Delete it if it's no longer needed."                   | Info     | Onshape grays out a mate whose instance is suppressed                                                                        | **⚑** New                   |
| "Rollback bar isn't at the end"            | "It leaves a feature out of the model. Drag it to the bottom of the list." / "It leaves {n} features out of…" | Warning  | A Part Studio's rollback bar is above its last feature                                                                       | **⚑** New                   |
| "Part with no material"                    | "Without one, its mass is wrong."                                                                             | Warning  | A solid part has no material                                                                                                 | **⚑** New                   |
| "Fixed instance"                           | "Fasten the Origin Cube to the assembly origin instead of fixing parts."                                      | Warning  | A top-level assembly instance is fixed                                                                                       | **⚑** New                   |
| "Floating instance"                        | "Mate or group it, so it can't drift."                                                                        | Warning  | A top-level instance isn't mated, grouped, fixed or copied by a pattern, Replicate or Mirror, outside a derived mirror's tab | **⚑** New                   |
| "Broken instance"                          | "What it was inserted from is gone or failing. Replace it or delete it."                                      | Error    | Onshape draws an instance red: its source is gone                                                                            | **⚑** New                   |

## The page

| String                                                                                                                                                                  | Kind               | Where                                                            | When                                              | Review          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------- | ------------------------------------------------- | --------------- |
| "Design Check"                                                                                                                                                          | Page name          | The page picker, under Utilities                                 | Launched in a workspace's Part Studio or Assembly | **⚑** New       |
| "Sign in to check this document"                                                                                                                                        | Notice title       | In place of the page                                             | Signed out                                        | **⚑** New       |
| "The design check reads it from your Onshape account."                                                                                                                  | Notice description | Under it                                                         | Same                                              | **⚑** New       |
| "Sign in"                                                                                                                                                               | Button             | Under it                                                         | Same                                              | **⚑** New       |
| "Checking this document..."                                                                                                                                             | Loading            | In place of the page                                             | The check is running                              | **⚑** New       |
| "Failed to check this document."                                                                                                                                        | Page error         | In place of the page                                             | Onshape refused or failed                         | **⚑** New       |
| "Check again"                                                                                                                                                           | Tooltip            | The navbar's refresh button                                      | On the page                                       | **⚑** New       |
| "Failed to check this document again. These are the last results."                                                                                                      | Error note         | Atop the last results                                            | **Check again** failed                            | **⚑** New       |
| "Checked at {time}"                                                                                                                                                     | Caption            | Beside the severity badges, or in the notice                     | A check has answered                              | **⚑** New       |
| "This tab"                                                                                                                                                              | Caption            | Under the launch's tab name                                      | Always                                            | **⚑** New       |
| "Not checked"                                                                                                                                                           | Badge              | Beside a tab's name                                              | Onshape failed on that tab                        | **⚑** New       |
| "Switch to this tab"                                                                                                                                                    | Tooltip            | Beside another tab's name                                        | Hovered                                           | **⚑** New       |
| "Nothing to fix in this tab."                                                                                                                                           | Note               | In a tab, opened                                                 | That tab found nothing                            | **⚑** New       |
| "Failed to check this tab."                                                                                                                                             | Note               | In a tab, opened                                                 | Onshape failed on that tab                        | **⚑** New       |
| "No issues found"                                                                                                                                                       | Notice title       | In place of the list                                             | The check found nothing                           | **⚑** New       |
| "Every Part Studio and Assembly in this document follows every practice the design check looks for."                                                                    | Notice description | Under it                                                         | Same                                              | **⚑** New       |
| "Onshape didn't say which sketches are fully defined, so under-defined sketches weren't checked. Over-defined sketches still show as features with errors or warnings." | Note               | Under the badges, or in the notice                               | Onshape listed no sketch's status                 | **⚑** New; long |
| "Open in Onshape"                                                                                                                                                       | Tooltip            | A feature or mate's name, not a suppressed Part Studio feature's | Hovered                                           | **⚑** New       |
| "Select in Onshape"                                                                                                                                                     | Tooltip            | A part's or part instance's name                                 | Hovered                                           | **⚑** New       |

The severity badges ("{n} errors", "{n} warnings", "{n} info") are the admin
card's, listed in [build-issues.md](./build-issues.md).

## The navbar's summary

In a library's navbar. The card's title is the page's name, "Design Check", and
it reuses "Not checked" and "Checked at {time}" from the page.

| String              | Kind               | Where                                       | When                 | Review    |
| ------------------- | ------------------ | ------------------------------------------- | -------------------- | --------- |
| "{n}"               | Count              | Beside an error or warning icon             | The document has any | **⚑** New |
| "Open Design Check" | Tooltip and button | The summary, and the foot of its hover card | A check has answered | **⚑** New |

## Fixing

| String                                                                                                                                       | Kind                        | Where                                        | When                            | Review    |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------- | ------------------------------- | --------- |
| "Move to the end" / "Delete" / "Fasten to origin"                                                                                            | Button                      | Beside the issue, or under its help          | The app can fix it              | **⚑** New |
| "Fix all"                                                                                                                                    | Button                      | Beside the time of the check                 | Any issue can be fixed          | **⚑** New |
| "Make these fixes?"                                                                                                                          | Modal title                 | The confirmation                             | A fix button or Fix all clicked | **⚑** New |
| "Each one changes the document in Onshape, and Ctrl+Z can't undo it. Uncheck any you'd rather leave."                                        | Description                 | Atop the list                                | Same                            | **⚑** New |
| "Move the rollback bar to the end" / "Delete {subject}" / "Fasten {subject} to the origin"                                                   | Checkbox label              | Each fix, its tab's name under it            | Same                            | **⚑** New |
| "Cancel" / "Make {n} fix" / "Make {n} fixes"                                                                                                 | Buttons                     | Under the list                               | Same                            | **⚑** New |
| "Failed to make a fix. Checking again shows what changed."                                                                                   | Error toast                 | Over the page                                | A fix was refused or failed     | **⚑** New |
| "Name the instance to fix." / "That instance is no longer in the Assembly." / "The Origin Cube's Part Studio no longer has the Origin Cube." | Server errors, in the toast | `src/backend/features/design-check/fixes.ts` | A fix can't be made             | **⚑** New |

## Dismissing

| String                                                   | Kind                       | Where                                         | When                             | Review    |
| -------------------------------------------------------- | -------------------------- | --------------------------------------------- | -------------------------------- | --------- |
| "Dismiss"                                                | Tooltip                    | Beside the issue, or under its help           | The caller may edit the document | **⚑** New |
| "Put back"                                               | Tooltip                    | Beside a dismissed issue                      | Dismissed issues shown           | **⚑** New |
| "Show {n} dismissed issue" / "Show {n} dismissed issues" | Link                       | Under the severity badges, or in the notice   | Any issue is dismissed           | **⚑** New |
| "Hide dismissed issues"                                  | Link                       | Same                                          | Dismissed issues shown           | **⚑** New |
| "Failed to save the change. It's back as it was."        | Error toast                | Over the page                                 | Saving a dismissal failed        | **⚑** New |
| "Dismissing an issue needs edit access to the document." | Server error, in the toast | `src/backend/features/design-check/routes.ts` | Edit access lost since the check | **⚑** New |
