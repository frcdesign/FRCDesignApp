# FeatureScripts: strings

What [featurescripts.md](../architecture/featurescripts.md) shows a person.
Each is a message in `src/frontend/messages/en.json`, keyed `featureScripts…`;
the sections marked proposed aren't built yet. A feature's name and
description come from its FeatureScript and are parameters, not messages.

## The tab and its cards

| String                                                          | Kind                    | Where                                         | When                                                          | Review           |
| --------------------------------------------------------------- | ----------------------- | --------------------------------------------- | ------------------------------------------------------------- | ---------------- |
| "FeatureScripts"                                                | Page name               | The page picker, under Utilities              | Always                                                        | **⚑** New        |
| "Search FeatureScripts..."                                      | Placeholder             | The search box, top of the list               | Always                                                        | **⚑** New        |
| "v{version}"                                                    | Badge                   | A card, beside the name; the details          | A version names its release                                   | **⚑** New        |
| "Add to Part Studio" / "Open example"                           | Menu items              | A card's ⋯ menu                               | Open example with one                                         | **⚑** New        |
| "Favorites"                                                     | Section title           | Top of the list                               | Signed in, with a favorite, not searching                     | **⚑** New        |
| "{folder}" / "Other"                                            | Section titles          | The list, after Favorites                     | Each folder in the frontend document; Other for its top level | **⚑** New: Other |
| "Favorite" / "Unfavorite"                                       | Button title, menu item | A card's heart and ⋯ menu; the details' heart | Signed in                                                     | **⚑** New        |
| "Failed to favorite {name}." / "Failed to unfavorite {name}."   | Error toast             |                                               | The toggle failed, without a worded reason                    | **⚑** New        |
| "Loading FeatureScripts..."                                     | Loading                 | In place of the list                          | The list is being read                                        | **⚑** New        |
| "Failed to load FeatureScripts."                                | Page error              | In place of the list                          | The list couldn't be read                                     | **⚑** New        |
| "No FeatureScripts yet" / "No FeatureScripts match your search" | Empty notice            | In place of the list                          | Nothing loaded / no match                                     | **⚑** New        |

## The details

| String                                       | Kind          | Where                   | When                                        | Review    |
| -------------------------------------------- | ------------- | ----------------------- | ------------------------------------------- | --------- |
| "FeatureScripts"                             | Back link     | Top of the page         | Always                                      | **⚑** New |
| "No example yet"                             | Image caption | In the hero image       | The feature has no example Part Studio      | **⚑** New |
| "Add to Part Studio"                         | Button        | Under the description   | Always                                      | **⚑** New |
| "Open a Part Studio to add this feature."    | Tooltip       | On the disabled button  | In an assembly, or standalone               | **⚑** New |
| "Open example"                               | Button        | Beside it               | The feature has an example                  | **⚑** New |
| "That FeatureScript is no longer available." | Page error    | In place of the details | The url names a feature not in the list     | **⚑** New |
| "Adding {name}..."                           | Loading toast |                         | The add started                             | **⚑** New |
| "Added {name}."                              | Success toast |                         | The add landed; its dialog opens in Onshape | **⚑** New |
| "Failed to add {name}."                      | Error toast   |                         | Onshape refused it, without a worded reason | **⚑** New |

## The owner's

| String                                                                    | Kind          | Where               | When              | Review    |
| ------------------------------------------------------------------------- | ------------- | ------------------- | ----------------- | --------- |
| "No example"                                                              | Badge         | A card; the details | `NO_EXAMPLE`      | **⚑** New |
| "Name a Part Studio \"{name} example\" in the frontend document."         | Badge tooltip | On it               | Same              | **⚑** New |
| "No icon"                                                                 | Badge         | A card; the details | `NO_ICON`         | **⚑** New |
| "Release it again to write \"{name} icon.svg\"."                          | Badge tooltip | On it               | Same              | **⚑** New |
| "Hidden"                                                                  | Badge         | A card; the details | `NOT_ONE_FEATURE` | **⚑** New |
| "Hidden from users: this Feature Studio must define exactly one feature." | Badge tooltip | On it               | Same              | **⚑** New |
| "Failed to load"                                                          | Badge         | A card; the details | `LOAD_FAILED`     | **⚑** New |
| "The last load of this feature failed. Reload to try again."              | Badge tooltip | On it               | Same              | **⚑** New |
| "Reload" / "Reloading FeatureScripts..."                                  | Button, toast | The tab's header    | Proposed          | **⚑** New |

## Feedback (proposed)

The form itself is [feedback.md](./feedback.md)'s; these are what a
FeatureScript report adds to it.

| String                                                     | Kind              | Where                           | When                                                | Review                                      |
| ---------------------------------------------------------- | ----------------- | ------------------------------- | --------------------------------------------------- | ------------------------------------------- |
| "Report an issue"                                          | Menu item, button | A card's ⋯ menu; the details    | Always                                              | **⚑** New                                   |
| "Report issue with {name}"                                 | Form title        | The feedback form               | Opened from a feature                               | **⚑** New                                   |
| "FeatureScripts"                                           | Topic option      | General feedback's topic picker | Always                                              | **⚑** New                                   |
| "Bug" / "Feature request" / "Kudos" / "Question" / "Other" | Type options      | The form                        | A FeatureScript report, or the FeatureScripts topic | Question as in [feedback.md](./feedback.md) |
| "{category}: {name}"                                       | Suggested title   | The form's title field          | Until the reporter writes their own                 |                                             |
| "FeatureScript: {name} v{version}"                         | Post field        | The Discord post                | A FeatureScript report                              | **⚑** New                                   |

## The dashboard (proposed)

| String                                                         | Kind           | Where                          | When                 | Review    |
| -------------------------------------------------------------- | -------------- | ------------------------------ | -------------------- | --------- |
| "FeatureScripts"                                               | Section title  | The overview, and its own page | Always               | **⚑** New |
| "Features added"                                               | Tile label     | The section                    | Always               | **⚑** New |
| "Users"                                                        | Tile label     | The section                    | Always               |           |
| "Feature" / "Adds" / "Users" / "Share" / "Reports" / "Release" | Column headers | The page's table               | Always               | **⚑** New |
| "No features added in this range."                             | Empty notice   | The section and page           | No adds in the range | **⚑** New |
