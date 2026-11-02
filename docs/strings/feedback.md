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

| String                                                                                                                           | Kind              | Where                 | When                                                            | Review                                   |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------- | --------------------------------------------------------------- | ---------------------------------------- |
| "Leave feedback" / "Report an issue" / "Send a report"                                                                           | Modal title       | The form              | Opened from settings / a part's menu / an error                 |                                          |
| "The report includes this error: {error}"                                                                                        | Error callout     | Top of the form       | Opened from an error                                            |                                          |
| "About {part} in {library}."                                                                                                     | Text              | In place of the topic | Opened from a part's menu                                       | **⚑** Was "About **{part}**…", now plain |
| "About"                                                                                                                          | Select label      | Top of the form       | Opened from settings or an error                                |                                          |
| "FRCDesignApp" / "Version Manager" / "FRCDesignLib" / "MKCad" / "ConfigLib"                                                      | Select options    | In it                 | Same                                                            |                                          |
| "To report a problem with one part, choose Report an issue in that part's menu."                                                 | Info callout      | Under it              | A library is chosen                                             |                                          |
| "Type"                                                                                                                           | Select label      | Next                  | Always                                                          |                                          |
| "Bug" / "Feature request" / "Other"                                                                                              | Select options    | In it                 | An app topic                                                    |                                          |
| "New part request" / "Search or organization" / "Bug" / "Other"                                                                  | Select options    | Same                  | A library topic                                                 |                                          |
| "Missing or incorrect metadata" / "Incorrect geometry" / "Broken configuration" / "Wrong or missing thumbnail" / "Bug" / "Other" | Select options    | Same                  | Opened from a part's menu                                       |                                          |
| "Title"                                                                                                                          | Field label       | Next                  | Always                                                          |                                          |
| "Names the report's thread in Discord."                                                                                          | Field description | Under it              | Always                                                          |                                          |
| "{type}: {about}"                                                                                                                | Field value       | In it                 | Until the reporter writes their own; an error's message instead |                                          |
| "Details"                                                                                                                        | Field label       | Next                  | Always; required unless from an error                           |                                          |
| "What did you do, what happened, and what did you expect?"                                                                       | Placeholder       | In it                 | Bug                                                             |                                          |
| "What would you like the app to do?"                                                                                             | Placeholder       | Same                  | Feature request                                                 |                                          |
| "Which part would you like added? A link to where it's sold helps."                                                              | Placeholder       | Same                  | New part request                                                |                                          |
| "Which field is wrong or missing, and what should it be?"                                                                        | Placeholder       | Same                  | Missing or incorrect metadata                                   |                                          |
| "What doesn't match the real part?"                                                                                              | Placeholder       | Same                  | Incorrect geometry                                              |                                          |
| "Which options break, and how?"                                                                                                  | Placeholder       | Same                  | Broken configuration                                            |                                          |
| "Tell us more."                                                                                                                  | Placeholder       | Same                  | Any other type                                                  |                                          |
| "Include the configuration"                                                                                                      | Checkbox          | Next                  | Opened from a configurable part's menu; on by default           |                                          |
| "Discord username"                                                                                                               | Field label       | Next                  | Always; optional                                                |                                          |
| "Optional, so the team knows who to answer in the report's thread."                                                              | Field description | Under it              | Always                                                          |                                          |
| "Failed to send the report."                                                                                                     | Error toast       |                       | The send failed for a reason the server didn't word             |                                          |

## Once sent

| String                                                                        | Kind               | Where                | When                           | Review |
| ----------------------------------------------------------------------------- | ------------------ | -------------------- | ------------------------------ | ------ |
| "Report sent!"                                                                | Success notice     | In place of the form | The report is in Discord       |        |
| "You can find your report in #{channel} if you want to follow up in Discord." | Notice description | Under it             | Same                           |        |
| "Open Discord"                                                                | Button             | Under it             | Same; opens the forum's invite |        |

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
the document.

| String                                                                                                                                                                                                                            | Kind       | Where                      | When                   | Review                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------- | ---------------------- | ------------------------------------------------- |
| "The FRCDesignApp can't edit this document"                                                                                                                                                                                       | Page title | Top                        | Always                 |                                                   |
| "Parts can only be inserted into a document the FRCDesignApp can edit. Either the app hasn't been given access to the account or classroom this document belongs to, or you can only view this document."                         | Intro      | Under it                   | Always                 |                                                   |
| "This document belongs to an Onshape Enterprise, but the FRCDesignApp was probably given access to your personal account instead. Click Try again below, and when Onshape asks, grant the FRCDesignApp access to the Enterprise." | Text       | Next                       | An Enterprise document |                                                   |
| "If your Enterprise limits which apps its members can use, ask an Enterprise admin to allow the FRCDesignApp."                                                                                                                    | Text       | Under it                   | Same                   |                                                   |
| "If this document is in an Onshape classroom, the classroom needs access to the FRCDesignApp as well. Open your Onshape Applications page, grant the FRCDesignApp access to the classroom, then click Try again below."           | Text       | Next                       | A personal document    | **⚑** New; check a classroom launches as personal |
| "Open Applications page"                                                                                                                                                                                                          | Button     | Under it                   | Same                   |                                                   |
| "Otherwise, the FRCDesignApp was probably given access to an Enterprise instead of your personal account. Click Try again below, and when Onshape asks, grant the FRCDesignApp access to your personal account."                  | Text       | Next                       | Same                   |                                                   |
| "Try again" / "Continue anyway"                                                                                                                                                                                                   | Buttons    | Bottom, with Send a report | Always                 |                                                   |

## The dashboard

| String                         | Kind                | Where                            | When                             | Review |
| ------------------------------ | ------------------- | -------------------------------- | -------------------------------- | ------ |
| "Reports"                      | Section title; tile | Overview and each library's page | Always                           |        |
| "From errors" / "About a part" | Tiles               | Beside it                        | Always                           |        |
| "No reports in this range."    | Empty text          | In place of the table            | No reports in the range          |        |
| "Most reported parts"          | Table title         | A library's page                 | A part was reported in the range |        |
