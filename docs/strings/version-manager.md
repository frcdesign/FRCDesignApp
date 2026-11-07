# Version manager: strings

What [version-manager.md](../architecture/version-manager.md) shows a person.
App text is a message in `src/frontend/messages/en.json`, keyed
`versionManager…`. The page, the welcome page and the suggestions are
migrated; the link rows, their menus, the forms and the run reports still
write their text in `src/frontend/features/version-manager/`, and the server's
own errors are written in `src/backend/features/version-manager/routes.ts`.

## The page

| String                                                  | Kind               | Where                | When                       | Review |
| ------------------------------------------------------- | ------------------ | -------------------- | -------------------------- | ------ |
| "Sign in to manage versions"                            | Notice title       | In place of the page | Signed out                 |        |
| "Pushing and pulling happen in your Onshape documents." | Notice description | Under it             | Same                       |        |
| "Loading linked documents..."                           | Loading            | In place of the page | The links are being read   |        |
| "Failed to load linked documents."                      | Page error         | In place of the page | The links couldn't be read |        |

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

## Suggested parents

| String                                                             | Kind              | Where                                               | When                                                    | Review                             |
| ------------------------------------------------------------------ | ----------------- | --------------------------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| "Found {count} documents this one references"                      | Card title        | The welcome page, above the card for linking by url | Nothing is linked, and something is suggested           | **⚑** New                          |
| "Link them as parents to pull their new versions into {document}." | Card description  | Under it                                            | Same                                                    | **⚑** New                          |
| "Link all as parents"                                              | Button            | Under the card's list                               | Same                                                    | **⚑** New                          |
| "Suggested parents"                                                | Section title     | The page's last section                             | Something is linked, and something is suggested         | **⚑** New                          |
| "Documents this one references that aren't linked yet."            | Info tooltip      | Beside the section's title                          | Same                                                    | **⚑** New                          |
| "Link all"                                                         | Button            | The section's header                                | Same                                                    | **⚑** New                          |
| "Link"                                                             | Button, menu item | Each suggestion's row, and its right-click menu     | Either                                                  | **⚑** New                          |
| "Open document"                                                    | Menu item         | A suggestion's right-click menu                     | Either                                                  |                                    |
| "Linked {count} documents."                                        | Success toast     |                                                     | **Link all** landed                                     | **⚑** New; says 0 when all skipped |
| "Unexpectedly failed to link the documents."                       | Error toast       |                                                     | **Link all** failed for a reason the server didn't word | **⚑** New                          |
