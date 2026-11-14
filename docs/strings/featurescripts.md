# FeatureScripts: strings

What [featurescripts.md](../architecture/featurescripts.md) shows a person.
Each is a message in `src/frontend/messages/en.json`, keyed `featureScripts…`;
the section marked proposed isn't built yet. A feature's name and
description come from the manifest robot-code writes and are parameters, not
messages.

## The tab and its cards

| String                                                          | Kind            | Where                                                              | When                                                          | Review                                  |
| --------------------------------------------------------------- | --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------- |
| "FeatureScripts"                                                | Page name       | The page picker, under Utilities                                   | Always                                                        | **⚑** New                               |
| "Search FeatureScripts..."                                      | Placeholder     | The navbar's second row                                            | Always                                                        | **⚑** New                               |
| "Get FeatureScript" / "Open example" / "View code"              | Menu items      | A card's ⋯ menu; the popup's ⋯ has Get FeatureScript and View code | Open example with an example; View code with a source         | **⚑** New: Get FeatureScript, View code |
| "Add"                                                           | Outlined button | Each row, before the heart                                         | In a Part Studio or an assembly; none standalone              | **⚑** New                               |
| "FeatureScripts can only be added to Part Studios."             | Tooltip         | On the disabled Add, row or popup                                  | In an assembly                                                | **⚑** New                               |
| "Favorites"                                                     | Section title   | Top of the list                                                    | Signed in, with a favorite, not searching                     | **⚑** New                               |
| "{folder}" / "Other"                                            | Section titles  | The list, after Favorites                                          | Each folder in the frontend document; Other for its top level | **⚑** New: Other                        |
| "Favorite" / "Unfavorite"                                       | Button title    | A card's heart; the popup's heart                                  | Signed in                                                     | **⚑** New                               |
| "Failed to favorite {name}." / "Failed to unfavorite {name}."   | Error toast     |                                                                    | The toggle failed, without a worded reason                    | **⚑** New                               |
| "Loading FeatureScripts..."                                     | Loading         | In place of the list                                               | The list is being read                                        | **⚑** New                               |
| "Failed to load FeatureScripts."                                | Page error      | In place of the list                                               | The list couldn't be read                                     | **⚑** New                               |
| "No FeatureScripts yet" / "No FeatureScripts match your search" | Empty notice    | In place of the list                                               | Nothing loaded / no match                                     | **⚑** New                               |

## The popup

| String                  | Kind              | Where                      | When                                        | Review    |
| ----------------------- | ----------------- | -------------------------- | ------------------------------------------- | --------- |
| "{name}"                | Popup title       | Beside the feature's icon  | Opened from a row                           |           |
| "No example yet"        | Empty state title | In place of the hero image | The feature has no example Part Studio      | **⚑** New |
| "Open example"          | Button            | The footer                 | The feature has an example                  | **⚑** New |
| "Add to Part Studio"    | Button            | The footer, last           | In a Part Studio or an assembly             | **⚑** New |
| "Adding {name}..."      | Loading toast     |                            | The add started                             | **⚑** New |
| "Added {name}."         | Success toast     |                            | The add landed; its dialog opens in Onshape | **⚑** New |
| "Failed to add {name}." | Error toast       |                            | Onshape refused it, without a worded reason | **⚑** New |

## The owner's card

A status icon beside each row's name and in the popup's footer, opening a hover
card with a part's admin card's sections. The owner's alone.

| String                                                            | Kind            | Where                     | When                                       | Review    |
| ----------------------------------------------------------------- | --------------- | ------------------------- | ------------------------------------------ | --------- |
| "{name}"                                                          | Card title      | Beside the feature's icon | Always                                     |           |
| "Build checks"                                                    | Section title   | The card                  | It has a problem                           | **⚑** New |
| "No example"                                                      | Callout         | In it                     | `NO_EXAMPLE`                               | **⚑** New |
| "Name a Part Studio \"{name} example\" in the frontend document." | Callout tooltip | On it                     | Same                                       | **⚑** New |
| "No icon"                                                         | Callout         | In it                     | `NO_ICON`                                  | **⚑** New |
| "Release it again to write \"{name} icon.svg\"."                  | Callout tooltip | On it                     | Same                                       | **⚑** New |
| "Failed to load"                                                  | Callout         | In it                     | `LOAD_FAILED`                              | **⚑** New |
| "The last load of this feature failed. Reload to try again."      | Callout tooltip | On it                     | Same                                       | **⚑** New |
| "Settings"                                                        | Section title   | The card                  | Always                                     | **⚑** New |
| "Visible to users"                                                | Switch row      | In it                     | Always                                     | **⚑** New |
| "Version"                                                         | Row label       | In it                     | Always                                     | **⚑** New |
| "v{version}" / "Unknown"                                          | Row value       | Beside it                 | The manifest gave one / didn't             | **⚑** New |
| "Usage"                                                           | Section title   | The card                  | Always                                     | **⚑** New |
| "Adds" / "Users" / "Favorites"                                    | Stat labels     | In it, under each number  | Always, all time                           | **⚑** New |
| "Failed to hide {name}." / "Failed to show {name}."               | Error toast     |                           | The switch failed, without a worded reason | **⚑** New |
| "Reload" / "Reloading FeatureScripts..."                          | Button, toast   | The tab's header          | Proposed                                   | **⚑** New |

## Feedback

The form itself is [feedback.md](./feedback.md)'s; these are what a
FeatureScript report adds to it.

| String                                        | Kind                | Where                                                          | When                                                       | Review    |
| --------------------------------------------- | ------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- | --------- |
| "Report an issue"                             | Menu item           | A row's ⋯ and right-click menu; the popup's ⋯, after a divider | Always                                                     |           |
| "Report issue with {name}"                    | Form title          | The feedback form                                              | Opened from a feature                                      | **⚑** New |
| "FeatureScripts"                              | Area option         | The form's About                                               | Opened from settings or `/feedback`, never from an error   | **⚑** New |
| "FeatureScript" / "None in particular"        | Select, placeholder | Under it                                                       | FeatureScripts is chosen                                   | **⚑** New |
| "Bug" / "Feature request" / "Kudos" / "Other" | Type options        | The form                                                       | A FeatureScript report, or the FeatureScripts area         |           |
| "{type}: {name}"                              | Suggested title     | The form's title field                                         | From a feature's menu, until the reporter writes their own |           |

## The dashboard (proposed)

| String                                             | Kind           | Where                          | When                 | Review    |
| -------------------------------------------------- | -------------- | ------------------------------ | -------------------- | --------- |
| "FeatureScripts"                                   | Section title  | The overview, and its own page | Always               | **⚑** New |
| "Features added"                                   | Tile label     | The section                    | Always               | **⚑** New |
| "Users"                                            | Tile label     | The section                    | Always               |           |
| "Feature" / "Adds" / "Users" / "Share" / "Reports" | Column headers | The page's table               | Always               | **⚑** New |
| "No features added in this range."                 | Empty notice   | The section and page           | No adds in the range | **⚑** New |
