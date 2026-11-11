# FeatureScripts: strings

What [featurescripts.md](../architecture/featurescripts.md) shows a person.
Proposed: each will be a message in `src/frontend/messages/en.json`, keyed
`featureScripts…`. A feature's name and description come from its
FeatureScript and are parameters, not messages.

## The tab and its cards

| String                  | Kind          | Where                    | When                                   | Review    |
| ----------------------- | ------------- | ------------------------ | -------------------------------------- | --------- |
| "FeatureScripts"        | Tab label     | The navbar               | Always                                 | **⚑** New |
| "Search FeatureScripts" | Placeholder   | The search box           | Always                                 | **⚑** New |
| "No example yet"        | Image caption | A card, in the thumbnail | The feature has no example Part Studio | **⚑** New |

## The details

| String                                            | Kind          | Where                  | When                                        | Review    |
| ------------------------------------------------- | ------------- | ---------------------- | ------------------------------------------- | --------- |
| "Add to Part Studio"                              | Button        | Under the description  | Always                                      | **⚑** New |
| "Open a Part Studio to add this feature."         | Tooltip       | On the disabled button | In an assembly, or standalone               | **⚑** New |
| "Open example"                                    | Button        | Beside it              | The feature has an example                  | **⚑** New |
| "Added {name}. Make its selections to finish it." | Success toast |                        | The add landed                              | **⚑** New |
| "Failed to add {name}."                           | Error toast   |                        | Onshape refused it, without a worded reason | **⚑** New |
