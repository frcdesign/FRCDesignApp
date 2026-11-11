# FeatureScripts: strings

What [featurescripts.md](../architecture/featurescripts.md) shows a person.
Proposed: each will be a message in `src/frontend/messages/en.json`, keyed
`featureScripts…`. A feature's name and description come from its
FeatureScript and are parameters, not messages.

## The tab and its cards

| String                           | Kind        | Where                   | When                        | Review    |
| -------------------------------- | ----------- | ----------------------- | --------------------------- | --------- |
| "FeatureScripts"                 | Tab label   | The navbar              | Always                      | **⚑** New |
| "Search FeatureScripts"          | Placeholder | The search box          | Always                      | **⚑** New |
| "v{version}"                     | Badge       | A card, beside the name | A version names its release | **⚑** New |
| "Report an issue"                | Menu item   | A card's ⋯ menu         | Always                      | **⚑** New |
| "Loading FeatureScripts..."      | Loading     | In place of the list    | The list is being read      | **⚑** New |
| "Failed to load FeatureScripts." | Page error  | In place of the list    | The list couldn't be read   | **⚑** New |

## The details

| String                                            | Kind          | Where                          | When                                        | Review                                  |
| ------------------------------------------------- | ------------- | ------------------------------ | ------------------------------------------- | --------------------------------------- |
| "No example yet"                                  | Image caption | The details, in the hero image | The feature has no example Part Studio      | **⚑** New                               |
| "Add to Part Studio"                              | Button        | Under the description          | Always                                      | **⚑** New                               |
| "Open a Part Studio to add this feature."         | Tooltip       | On the disabled button         | In an assembly, or standalone               | **⚑** New                               |
| "Open example"                                    | Button        | Beside it                      | The feature has an example                  | **⚑** New                               |
| "Report an issue"                                 | Button        | Beside them                    | Always                                      | **⚑** New; repeats the card's menu item |
| "Added {name}. Make its selections to finish it." | Success toast |                                | The add landed                              | **⚑** New                               |
| "Failed to add {name}."                           | Error toast   |                                | Onshape refused it, without a worded reason | **⚑** New                               |

## Feedback

The form itself is [feedback.md](./feedback.md)'s; these are what a
FeatureScript report adds to it.

| String                                                                | Kind            | Where                           | When                                                | Review                           |
| --------------------------------------------------------------------- | --------------- | ------------------------------- | --------------------------------------------------- | -------------------------------- |
| "Report issue with {name}"                                            | Form title      | The feedback form               | Opened from a feature                               | **⚑** New                        |
| "FeatureScripts"                                                      | Topic option    | General feedback's topic picker | Always                                              | **⚑** New                        |
| "Bug" / "Feature request" / "Unclear description" / "Kudos" / "Other" | Type options    | The form                        | A FeatureScript report, or the FeatureScripts topic | **⚑** New: "Unclear description" |
| "{category}: {name}"                                                  | Suggested title | The form's title field          | Until the reporter writes their own                 |                                  |
| "FeatureScript: {name} v{version}"                                    | Post field      | The Discord post                | A FeatureScript report                              | **⚑** New                        |

## The owner's

| String                                                    | Kind          | Where            | When              | Review    |
| --------------------------------------------------------- | ------------- | ---------------- | ----------------- | --------- |
| "Reload"                                                  | Button        | The tab's header | Owner             | **⚑** New |
| "Reloading FeatureScripts..."                             | Loading toast |                  | A reload started  | **⚑** New |
| "No example: name a Part Studio \"{name} example\"."      | Badge tooltip | A card           | `NO_EXAMPLE`      | **⚑** New |
| "Hidden: this Feature Studio defines {count} features."   | Badge tooltip | A card           | `NOT_ONE_FEATURE` | **⚑** New |
| "No icon: release it again to write \"{name} icon.svg\"." | Badge tooltip | A card           | `NO_ICON`         | **⚑** New |
| "Failed to load."                                         | Badge tooltip | A card           | `LOAD_FAILED`     | **⚑** New |

## The dashboard

| String                                                         | Kind           | Where                          | When                 | Review    |
| -------------------------------------------------------------- | -------------- | ------------------------------ | -------------------- | --------- |
| "FeatureScripts"                                               | Section title  | The overview, and its own page | Always               | **⚑** New |
| "Features added"                                               | Tile label     | The section                    | Always               | **⚑** New |
| "Users"                                                        | Tile label     | The section                    | Always               |           |
| "Feature" / "Adds" / "Users" / "Share" / "Reports" / "Release" | Column headers | The page's table               | Always               | **⚑** New |
| "No features added in this range."                             | Empty notice   | The section and page           | No adds in the range | **⚑** New |
