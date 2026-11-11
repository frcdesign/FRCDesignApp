# FeatureScripts: strings

What [featurescripts.md](../architecture/featurescripts.md) shows a person.
Each is a message in `src/frontend/messages/en.json`, keyed `featureScripts…`;
the sections marked proposed aren't built yet. A feature's name and
description come from its FeatureScript and are parameters, not messages.

## The tab and its cards

| String                                                          | Kind                    | Where                                        | When                                                          | Review           |
| --------------------------------------------------------------- | ----------------------- | -------------------------------------------- | ------------------------------------------------------------- | ---------------- |
| "FeatureScripts"                                                | Page name               | The page picker, under Utilities             | Always                                                        | **⚑** New        |
| "Search FeatureScripts..."                                      | Placeholder             | The navbar's second row                      | Always                                                        | **⚑** New        |
| "Add to Part Studio" / "Open example"                           | Menu items              | A card's ⋯ menu                              | Open example with one                                         | **⚑** New        |
| "Add"                                                           | Outlined button         | Each row, before the heart                   | In a Part Studio or an assembly; none standalone              | **⚑** New        |
| "FeatureScripts can only be added to Part Studios."             | Tooltip                 | On the disabled Add, row or popup            | In an assembly                                                | **⚑** New        |
| "Favorites"                                                     | Section title           | Top of the list                              | Signed in, with a favorite, not searching                     | **⚑** New        |
| "{folder}" / "Other"                                            | Section titles          | The list, after Favorites                    | Each folder in the frontend document; Other for its top level | **⚑** New: Other |
| "Favorite" / "Unfavorite"                                       | Button title, menu item | A card's heart and ⋯ menu; the popup's heart | Signed in                                                     | **⚑** New        |
| "Failed to favorite {name}." / "Failed to unfavorite {name}."   | Error toast             |                                              | The toggle failed, without a worded reason                    | **⚑** New        |
| "Loading FeatureScripts..."                                     | Loading                 | In place of the list                         | The list is being read                                        | **⚑** New        |
| "Failed to load FeatureScripts."                                | Page error              | In place of the list                         | The list couldn't be read                                     | **⚑** New        |
| "No FeatureScripts yet" / "No FeatureScripts match your search" | Empty notice            | In place of the list                         | Nothing loaded / no match                                     | **⚑** New        |

## The popup

| String                  | Kind          | Where                     | When                                        | Review    |
| ----------------------- | ------------- | ------------------------- | ------------------------------------------- | --------- |
| "{name}"                | Popup title   | Beside the feature's icon | Opened from a row                           |           |
| "No example yet"        | Image caption | In the hero image         | The feature has no example Part Studio      | **⚑** New |
| "Open example"          | Button        | The footer                | The feature has an example                  | **⚑** New |
| "Add to Part Studio"    | Button        | The footer, last          | In a Part Studio or an assembly             | **⚑** New |
| "Adding {name}..."      | Loading toast |                           | The add started                             | **⚑** New |
| "Added {name}."         | Success toast |                           | The add landed; its dialog opens in Onshape | **⚑** New |
| "Failed to add {name}." | Error toast   |                           | Onshape refused it, without a worded reason | **⚑** New |

## The owner's

| String                                                                    | Kind          | Where             | When                                       | Review    |
| ------------------------------------------------------------------------- | ------------- | ----------------- | ------------------------------------------ | --------- |
| "Hide from users" / "Show to users"                                       | Menu item     | A row's ⋯ menu    | The owner, shown / hidden                  | **⚑** New |
| "Hidden"                                                                  | Badge         | A card; the popup | The owner hid it                           | **⚑** New |
| "Hidden from users. Show it again from its ⋯ menu."                       | Badge tooltip | On it             | Same                                       | **⚑** New |
| "Failed to hide {name}." / "Failed to show {name}."                       | Error toast   |                   | The toggle failed, without a worded reason | **⚑** New |
| "No example"                                                              | Badge         | A card; the popup | `NO_EXAMPLE`                               | **⚑** New |
| "Name a Part Studio \"{name} example\" in the frontend document."         | Badge tooltip | On it             | Same                                       | **⚑** New |
| "No icon"                                                                 | Badge         | A card; the popup | `NO_ICON`                                  | **⚑** New |
| "Release it again to write \"{name} icon.svg\"."                          | Badge tooltip | On it             | Same                                       | **⚑** New |
| "Not one feature"                                                         | Badge         | A card; the popup | `NOT_ONE_FEATURE`                          | **⚑** New |
| "Hidden from users: this Feature Studio must define exactly one feature." | Badge tooltip | On it             | Same                                       | **⚑** New |
| "Failed to load"                                                          | Badge         | A card; the popup | `LOAD_FAILED`                              | **⚑** New |
| "The last load of this feature failed. Reload to try again."              | Badge tooltip | On it             | Same                                       | **⚑** New |
| "Reload" / "Reloading FeatureScripts..."                                  | Button, toast | The tab's header  | Proposed                                   | **⚑** New |

## Feedback (proposed)

The form itself is [feedback.md](./feedback.md)'s; these are what a
FeatureScript report adds to it.

| String                                                     | Kind              | Where                           | When                                                | Review                                      |
| ---------------------------------------------------------- | ----------------- | ------------------------------- | --------------------------------------------------- | ------------------------------------------- |
| "Report an issue"                                          | Menu item, button | A card's ⋯ menu; the popup      | Always                                              | **⚑** New                                   |
| "Report issue with {name}"                                 | Form title        | The feedback form               | Opened from a feature                               | **⚑** New                                   |
| "FeatureScripts"                                           | Topic option      | General feedback's topic picker | Always                                              | **⚑** New                                   |
| "Bug" / "Feature request" / "Kudos" / "Question" / "Other" | Type options      | The form                        | A FeatureScript report, or the FeatureScripts topic | Question as in [feedback.md](./feedback.md) |
| "{category}: {name}"                                       | Suggested title   | The form's title field          | Until the reporter writes their own                 |                                             |

## The dashboard (proposed)

| String                                             | Kind           | Where                          | When                 | Review    |
| -------------------------------------------------- | -------------- | ------------------------------ | -------------------- | --------- |
| "FeatureScripts"                                   | Section title  | The overview, and its own page | Always               | **⚑** New |
| "Features added"                                   | Tile label     | The section                    | Always               | **⚑** New |
| "Users"                                            | Tile label     | The section                    | Always               |           |
| "Feature" / "Adds" / "Users" / "Share" / "Reports" | Column headers | The page's table               | Always               | **⚑** New |
| "No features added in this range."                 | Empty notice   | The section and page           | No adds in the range | **⚑** New |
