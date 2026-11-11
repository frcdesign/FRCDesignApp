# Library pages: strings

The library's pages, which have no architecture document of their own; how a
document loads is in [loading.md](../architecture/loading.md). Messages are
keyed `groupPage…`, `changesBadge…`, `library…` and `insert…` in
`src/frontend/messages/en.json`. Only what has moved into the catalog is
listed so far: the rest join as their strings move there.

## Menus

| String                                                | Kind          | Where                                         | When                                                  | Review    |
| ----------------------------------------------------- | ------------- | --------------------------------------------- | ----------------------------------------------------- | --------- |
| "Insert" / "Configuration" / "Favorites" / "Document" | Menu sections | A part's menu; a favorite's and a recent's    | As each applies                                       |           |
| "Update references"                                   | Menu item     | The Admin section of a part's or group's menu | An editor or above                                    | **⚑** New |
| "Updating references..."                              | Loading toast |                                               | While the update runs                                 | **⚑** New |
| "Updated references."                                 | Success toast |                                               | Something moved                                       | **⚑** New |
| "References are already up to date."                  | Success toast |                                               | Nothing was out of date                               | **⚑** New |
| "Failed to update references."                        | Error toast   |                                               | The update failed for a reason the server didn't word | **⚑** New |

## Row buttons

Every part row (a group's, Favorites', Recently Used's) carries the same
outlined button, before its heart and ⋯; the button is
`src/frontend/features/insert/components/quick-insert-button.tsx`.

| String                                            | Kind            | Where                  | When                                            | Review    |
| ------------------------------------------------- | --------------- | ---------------------- | ----------------------------------------------- | --------- |
| "Insert" / "Derive"                               | Outlined button | Each part row          | In an assembly / a Part Studio; none standalone | **⚑** New |
| "Assemblies can't be derived into a Part Studio." | Tooltip         | On the disabled button | An assembly's row, in a Part Studio             | **⚑** New |

## Group page

| String                                    | Kind                           | Where                 | When                                                      | Review                              |
| ----------------------------------------- | ------------------------------ | --------------------- | --------------------------------------------------------- | ----------------------------------- |
| "Group not found"                         | Page notice                    | In place of the group | The url names a group the library doesn't have            |                                     |
| "Loading document from Onshape..."        | Loading notice, with a spinner | In place of the list  | The group has no elements yet and its document is loading | **⚑** New                           |
| "This group failed to load."              | Notice                         | Same                  | No elements, not loading, and its last load failed        |                                     |
| "Reload outdated documents to try again." | Notice description             | Under it              | Same                                                      | **⚑** Dropped "or delete the group" |
| "This group has no visible elements"      | Notice                         | Same                  | It loaded, but every element is hidden from users         |                                     |
| "All elements are hidden by filters"      | Notice, with Clear filters     | Same                  | The vendor filters leave nothing                          |                                     |

## Change badges

On group and part cards in admin mode, and on a parent's row in the version
manager; see [version-manager.md](../architecture/version-manager.md).

| String                                                                         | Kind    | Where                             | When                                                              | Review    |
| ------------------------------------------------------------------------------ | ------- | --------------------------------- | ----------------------------------------------------------------- | --------- |
| "1 change" / "{count} changes"                                                 | Badge   | Beside a group's or parent's name | Its document's workspace has edits its last version doesn't carry |           |
| "1 change since the last version." / "{count} changes since the last version." | Tooltip | On that badge                     | Hovering it                                                       |           |
| "Changed"                                                                      | Badge   | Beside a part's name              | Its tab changed since the version the library holds               | **⚑** New |
