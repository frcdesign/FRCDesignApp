# Feedback and reports: strings

What [feedback.md](../architecture/feedback.md) shows a person, and the access
page [auth.md](../architecture/auth.md) sends a launch to. App text is a message
in `src/frontend/messages/en.json`, keyed `feedback…`, `documentAccess…` and
`dashboardReports…`; topics and types map to theirs in
`src/frontend/features/feedback/labels.ts`. The server's own errors and the
Discord post are written in `src/backend/features/feedback/`.

## Where a report starts

| String                                    | Kind               | Where                                                                      | When                                                    | Review |
| ----------------------------------------- | ------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------- | ------ |
| "Feedback"                                | Setting label      | Settings                                                                   | Always                                                  |        |
| "Leave feedback"                          | Button             | Beside it                                                                  | Always; opens the form                                  |        |
| "Feedback"                                | Menu section       | A part's menu, on its card or in the insert menu                           | Always                                                  |        |
| "Report an issue"                         | Menu item, dotted  | Under it                                                                   | Always; dotted until a menu offering it has been closed |        |
| "Report"                                  | Toast button       | On an error toast                                                          | Any error toast but sign-in's                           |        |
| "If the problem persists, send a report." | Notice description | Under a section or page error                                              | A load failed                                           |        |
| "Send a report"                           | Button             | Beside it; under a failed version run; on the cookie error and access page | Same                                                    |        |

## The form

| String                                                                                               | Kind           | Where           | When                                                                                                       | Review                                           |
| ---------------------------------------------------------------------------------------------------- | -------------- | --------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| "Leave feedback" / "Report issue with {part}" / "Send a report"                                      | Modal title    | The form        | Opened from settings / a part's menu / an error                                                            | **⚑** Was "Report an issue" from a part's menu   |
| "The report includes this error: {error}"                                                            | Error callout  | Top of the form | Opened from an error                                                                                       |                                                  |
| "About"                                                                                              | Select label   | Top of the form | Opened from settings or an error                                                                           |                                                  |
| "FRCDesignApp" / "Version Manager" / "FRCDesignLib" / "MKCad" / "ConfigLib"                          | Select options | In it           | Same                                                                                                       |                                                  |
| "To report an issue with a specific part, use the Report an issue button in the configuration menu." | Info callout   | Under it        | A library is chosen                                                                                        | **⚑** New wording                                |
| "Type"                                                                                               | Select label   | Next            | Always                                                                                                     |                                                  |
| "Bug" / "Feature request" / "Kudos" / "Other"                                                        | Select options | In it           | An app topic                                                                                               | **⚑** Kudos is new                               |
| "New part request" / "Search or organization" / "Bug" / "Kudos" / "Other"                            | Select options | Same            | A library topic                                                                                            | **⚑** Kudos is new                               |
| "Missing or incorrect metadata" / "Incorrect geometry" / "Broken configuration" / "Bug" / "Other"    | Select options | Same            | Opened from a part's menu                                                                                  | **⚑** Wrong or missing thumbnail removed         |
| "Title"                                                                                              | Field label    | Next            | Always                                                                                                     |                                                  |
| "{type}: {about}"                                                                                    | Field value    | In it           | A part report, until the reporter writes their own; an error's message instead; empty for general feedback |                                                  |
| "What is this request about?"                                                                        | Placeholder    | Same            | While it is empty                                                                                          | **⚑** New                                        |
| "Description"                                                                                        | Field label    | Next            | Always; required unless from an error                                                                      | **⚑** Was "Details"                              |
| "What did you do, what happened, and what did you expect?"                                           | Placeholder    | In it           | Bug                                                                                                        |                                                  |
| "What would you like the app to do?"                                                                 | Placeholder    | Same            | Feature request                                                                                            |                                                  |
| "Which part would you like added? Include a link if possible."                                       | Placeholder    | Same            | New part request                                                                                           | **⚑** New wording                                |
| "Which field is wrong or missing, and what should it be?"                                            | Placeholder    | Same            | Missing or incorrect metadata                                                                              |                                                  |
| "What doesn't match the real part?"                                                                  | Placeholder    | Same            | Incorrect geometry                                                                                         |                                                  |
| "Which options break, and how?"                                                                      | Placeholder    | Same            | Broken configuration                                                                                       |                                                  |
| "What would you like to thank the team for?"                                                         | Placeholder    | Same            | Kudos                                                                                                      | **⚑** New                                        |
| "Tell us more."                                                                                      | Placeholder    | Same            | Any other type                                                                                             |                                                  |
| "Include configuration"                                                                              | Checkbox       | Next            | Opened from a configurable part's insert menu; on by default                                               | **⚑** Was "Include the configuration"            |
| "Discord username (optional)"                                                                        | Field label    | Next            | Always; optional                                                                                           | **⚑** Was "Discord username", with a description |
| "Team number (optional)"                                                                             | Field label    | Under it        | Always; optional, a whole number                                                                           | **⚑** New                                        |
| "Failed to send the report."                                                                         | Error toast    |                 | The send failed for a reason the server didn't word                                                        |                                                  |

## Once sent

| String                                                                        | Kind               | Where                | When                           | Review                |
| ----------------------------------------------------------------------------- | ------------------ | -------------------- | ------------------------------ | --------------------- |
| "Report sent!"                                                                | Success notice     | In place of the form | The report is in Discord       |                       |
| "You can find your report in #{channel} if you want to follow up in Discord." | Notice description | Under it             | Same                           |                       |
| "Open Discord"                                                                | Button             | Under it             | Same; opens the forum's invite |                       |
| "Close"                                                                       | Button             | Footer, bottom right | Same                           | **⚑** Was bottom left |

## From the server

Worded on the server, so they aren't in the catalog.

| String                                                                           | Kind         | When                                           | Review |
| -------------------------------------------------------------------------------- | ------------ | ---------------------------------------------- | ------ |
| "Reports can't be sent right now. Please post in the FRCDesign Discord instead." | Error toast  | The topic's webhook isn't set                  |        |
| "You've sent a lot of reports recently. Please try again in an hour."            | Error toast  | More than 10 reports in an hour                |        |
| "Something went wrong. If it keeps happening, send a report."                    | Step failure | A version run step failed for no worded reason |        |

## Elsewhere in the app

| String                                                                                                                                                                                                      | Kind                     | Where                       | When                                      | Review                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------- | ----------------------------------------- | ------------------------------- |
| "The app has crashed due to an unexpected error."                                                                                                                                                           | Page notice; crash text  | In place of the app         | Rendering failed                          |                                 |
| "If the problem persists, report it in the FRCDesign Discord."                                                                                                                                              | Link                     | After it, on the crash page | The root itself failed, so no report form | **⚑** Now the link's whole text |
| "Failed to find page."                                                                                                                                                                                      | Page notice              | In place of the page        | The url matches no page                   |                                 |
| "Go home"                                                                                                                                                                                                   | Button                   | Beside Send a report        | Same                                      |                                 |
| "Cannot Set Authentication Cookie"                                                                                                                                                                          | Page title               | `/cookie-error`             | Sign-in couldn't set its cookie           |                                 |
| "The FRCDesignApp could not set an authentication cookie. Please try clearing your cookies and ensure your browser is set to allow cookies from third-party sites. If the problem persists, send a report." | Page description         | Under it                    | Same                                      |                                 |
| "Unexpectedly failed to reorder group." / "Failed to set the default configuration."                                                                                                                        | Error toast, with Report |                             | The reorder / the save failed             |                                 |

## The access page

`/document-access`, where `/init` sends a launch whose Onshape grant can't edit
the document: one notice per cause, chosen by the session's company.

| String                                                                                                                                 | Kind             | Where                        | When                                     | Review    |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------- | ---------------------------------------- | --------- |
| "The FRCDesignApp can't edit this document."                                                                                           | Page title       | `/document-access`           | Always                                   | **⚑** New |
| "Sign in and choose your personal account. If the problem persists, send a report."                                                    | Page description | Under it                     | The launch's session is in an Enterprise | **⚑** New |
| "Sign in"                                                                                                                              | Button           | Under it, with Send a report | Same                                     | **⚑** New |
| "Authorize the FRCDesignApp for your classroom on the Applications page, then reopen the app. If the problem persists, send a report." | Page description | Under the title              | The launch's session is personal         | **⚑** New |
| "Open Applications page"                                                                                                               | Button           | Under it, with Send a report | Same                                     |           |

## The dashboard

| String                         | Kind                | Where                            | When                             | Review |
| ------------------------------ | ------------------- | -------------------------------- | -------------------------------- | ------ |
| "Reports"                      | Section title; tile | Overview and each library's page | Always                           |        |
| "From errors" / "About a part" | Tiles               | Beside it                        | Always                           |        |
| "No reports in this range."    | Empty text          | In place of the table            | No reports in the range          |        |
| "Most reported parts"          | Table title         | A library's page                 | A part was reported in the range |        |
