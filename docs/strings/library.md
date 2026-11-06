# Library pages: strings

The library's pages, which have no architecture document of their own; how a
document loads is in [loading.md](../architecture/loading.md). Messages are
keyed `groupPage…` in `src/frontend/messages/en.json`. Only the group page is
listed so far: the rest join as their strings move into the catalog.

## Group page

| String                                                         | Kind                           | Where                 | When                                                      | Review    |
| -------------------------------------------------------------- | ------------------------------ | --------------------- | --------------------------------------------------------- | --------- |
| "Group not found"                                              | Page notice                    | In place of the group | The url names a group the library doesn't have            |           |
| "Loading document from Onshape..."                             | Loading notice, with a spinner | In place of the list  | The group has no elements yet and its document is loading | **⚑** New |
| "This group failed to load."                                   | Notice                         | Same                  | No elements, not loading, and its last load failed        |           |
| "Reload outdated documents to try again, or delete the group." | Notice description             | Under it              | Same                                                      |           |
| "This group has no visible elements"                           | Notice                         | Same                  | It loaded, but every element is hidden from users         |           |
| "All elements are hidden by filters"                           | Notice, with Clear filters     | Same                  | The vendor filters leave nothing                          |           |
