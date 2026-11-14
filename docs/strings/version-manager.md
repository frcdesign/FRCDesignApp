# Version manager: strings

What [version-manager.md](../architecture/version-manager.md) shows a person.
App text is a message in `src/frontend/messages/en.json`, keyed
`versionManager…`. The page, the welcome page, the suggestions and the link
rows with their menus, and the push and pull forms' own fields, are migrated,
but for each direction's own words (`direction-copy.ts`); the shared form
(`version-form.tsx`) and the run reports still write their text in
`src/frontend/features/version-manager/`, and the server's
own errors are written in `src/backend/features/version-manager/routes.ts`.

## The page

| String                                                              | Kind               | Where                | When                               | Review    |
| ------------------------------------------------------------------- | ------------------ | -------------------- | ---------------------------------- | --------- |
| "Version Manager is not available"                                  | Notice title       | In place of the page | Standalone                         | **⚑** New |
| "To use Version Manager, open FRCDesignApp in an Onshape document." | Notice description | Under it             | Same                               | **⚑** New |
| "Version Manager only works in a workspace"                         | Notice title       | In place of the page | Launched from Onshape in a version | **⚑** New |
| "Open this document's workspace to push and pull its versions."     | Notice description | Under it             | Same                               | **⚑** New |
| "Sign in to manage versions"                                        | Notice title       | In place of the page | Signed out                         |           |
| "Pushing and pulling happen in your Onshape documents."             | Notice description | Under it             | Same                               |           |
| "Loading linked documents..."                                       | Loading            | In place of the page | The links are being read           |           |
| "Failed to load linked documents."                                  | Page error         | In place of the page | The links couldn't be read         |           |

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

## A linked document's row

| String                                                                                                                   | Kind                                | Where                           | When                                   | Review    |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------- | -------------------------------------- | --------- |
| "Push" / "Pull"                                                                                                          | Outlined button                     | Each row, before its ⋯          | A child / a parent the caller can open | **⚑** New |
| "Wait for the push or pull running now to finish."                                                                       | Tooltip                             | On the disabled button          | A run is going from this workspace     | **⚑** New |
| "Push" / "Pull"                                                                                                          | Menu section                        | The row's and the section's ⋯   | The caller can open it                 |           |
| "Quick recursive push" / "Quick recursive pull"                                                                          | Menu item                           | In it                           | Same                                   |           |
| "Update references" / "Update all references"                                                                            | Menu item                           | In it, a row's / the section's  | Same                                   |           |
| "Link"                                                                                                                   | Menu section                        | The row's ⋯                     | Always                                 |           |
| "Open document"                                                                                                          | Menu item                           | In it                           | The caller can open it                 |           |
| "Switch to child" / "Switch to parent"                                                                                   | Menu item                           | Same                            | A parent / a child                     |           |
| "Remove link"                                                                                                            | Menu item, confirm title and button | Same                            | Always                                 |           |
| "Are you sure you want to delete the link to {document}?" / "Are you sure you want to delete the link to this document?" | Confirm body                        | The remove confirm              | Named / the caller can't open it       |           |
| "Missing access"                                                                                                         | Row title                           | In place of the document's name | The caller can't open it               |           |
| "You cannot open this document"                                                                                          | Row subtitle                        | Under it                        | Same                                   |           |

## The push and pull forms

| String                                                                                                                                                                                                           | Kind          | Where             | When                                         | Review     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------- | -------------------------------------------- | ---------- |
| "Push" / "Pull"                                                                                                                                                                                                  | Submit button | The form's footer | A child's / a parent's form                  |            |
| "Recursive"                                                                                                                                                                                                      | Checkbox      | The form          | Always                                       |            |
| "Recursively push changes across multiple links."                                                                                                                                                                | Checkbox info | Beside it         | A child's form                               |            |
| "Also pulls into the parent from the documents linked above it first, saving a new version of each one along the way so the next can use it. Each is numbered from its own versions unless you name them above." | Checkbox info | Beside it         | A parent's form                              | **⚑** Long |
| "Tip: Quick recursive push in a link's ⋯ menu does this in one click, without opening the form." / "Tip: Quick recursive pull in a link's ⋯ menu does this in one click, without opening the form."              | Tip toast     |                   | A recursive push / pull from the form landed | **⚑** New  |
