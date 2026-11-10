# Version manager: strings

What [version-manager.md](../architecture/version-manager.md) shows a person.
App text is a message in `src/frontend/messages/en.json`, keyed
`versionManager…`. The page, the welcome page and the suggestions are
migrated; the link rows, their menus, the forms and the run reports still
write their text in `src/frontend/features/version-manager/`, and the server's
own errors are written in `src/backend/features/version-manager/routes.ts`.

## The page

| String                                                              | Kind               | Where                            | When                               | Review                     |
| ------------------------------------------------------------------- | ------------------ | -------------------------------- | ---------------------------------- | -------------------------- |
| "Version Manager"                                                   | Page name          | The page picker, under Utilities | Always                             | **⚑** Moved to the catalog |
| "Version Manager is not available"                                  | Notice title       | In place of the page             | Standalone                         | **⚑** New                  |
| "To use Version Manager, open FRCDesignApp in an Onshape document." | Notice description | Under it                         | Same                               | **⚑** New                  |
| "Version Manager only works in a workspace"                         | Notice title       | In place of the page             | Launched from Onshape in a version | **⚑** New                  |
| "Open this document's workspace to push and pull its versions."     | Notice description | Under it                         | Same                               | **⚑** New                  |
| "Sign in to manage versions"                                        | Notice title       | In place of the page             | Signed out                         |                            |
| "Pushing and pulling happen in your Onshape documents."             | Notice description | Under it                         | Same                               |                            |
| "Loading linked documents..."                                       | Loading            | In place of the page             | The links are being read           |                            |
| "Failed to load linked documents."                                  | Page error         | In place of the page             | The links couldn't be read         |                            |

## The welcome page

| String                                                                                                                                                                | Kind                    | Where                       | When              | Review     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------- | ----------------- | ---------- |
| "Welcome to Version Manager!"                                                                                                                                         | Notice title            | Top of the page             | Nothing is linked |            |
| "Version Manager lets you automatically push and pull versions between Onshape documents. To get started, paste the link of another associated Onshape document."     | Notice description      | Under it                    | Same              | **⚑** Long |
| "Intake" / "Drivetrain" / "Shooter" / "Robot"                                                                                                                         | Diagram labels          | The example diagram         | Same              |            |
| "Parents" / "Children"                                                                                                                                                | Diagram labels          | Between its rows            | Same              |            |
| "The document I'm linking to is..."                                                                                                                                   | Radio group label       | The card for linking by url | Same              |            |
| "A parent" / "A child"                                                                                                                                                | Radio card titles       | In it                       | Same              |            |
| "I want to pull changes from the linked document into this document ({document})." / "I want to push changes from this document ({document}) to the linked document." | Radio card descriptions | Under each                  | Same              |            |

## Suggested links

| String                                                  | Kind              | Where                                                     | When                                                                  | Review                             |
| ------------------------------------------------------- | ----------------- | --------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| "Suggested links"                                       | Card title        | The welcome page, in place of the card for linking by url | Nothing is linked, and something is suggested                         | **⚑** New                          |
| "Link these documents to pull changes into {document}." | Card description  | Under it                                                  | Same                                                                  | **⚑** New                          |
| "Link all"                                              | Button            | Under the card's list                                     | Same                                                                  | **⚑** New                          |
| "Link a different document" / "Back to suggested links" | Subtle button     | Under the card                                            | Same; swaps the suggestions for the card for linking by url, and back | **⚑** New                          |
| "Suggestions"                                           | Menu section      | The parents' header menu                                  | Something is linked, and something is suggested                       | **⚑** New                          |
| "Link all"                                              | Menu item         | In it                                                     | Same                                                                  | **⚑** New                          |
| "Suggested: this document references it."               | Tooltip           | On the bulb beside a suggestion's name                    | Either                                                                | **⚑** New                          |
| "Link"                                                  | Button, menu item | Each suggestion's row, and its right-click menu           | Either                                                                | **⚑** New                          |
| "Open document"                                         | Menu item         | A suggestion's right-click menu                           | Either                                                                |                                    |
| "Linked {count} documents."                             | Success toast     |                                                           | **Link all** landed                                                   | **⚑** New; says 0 when all skipped |
| "Unexpectedly failed to link the documents."            | Error toast       |                                                           | **Link all** failed for a reason the server didn't word               | **⚑** New                          |
