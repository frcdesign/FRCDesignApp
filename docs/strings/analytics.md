# Analytics and the dashboard: strings

What [analytics.md](../architecture/analytics.md) shows on the public
dashboard. Messages are keyed `dashboard…` in `src/frontend/messages/en.json`;
the reports' own strings are in [feedback.md](./feedback.md). Listed so far: the
usage numbers, charts and tables; the rest join as their strings move into the
catalog. A **use** is an insert or a download.

## Headline tiles

| String           | Kind       | Where               | When                          | Review                     |
| ---------------- | ---------- | ------------------- | ----------------------------- | -------------------------- |
| "Total uses"     | Tile label | First headline tile | Always; inserts and downloads | **⚑** Now counts downloads |
| "Total users"    | Tile label | Beside it           | Always                        |                            |
| "Uses per user"  | Tile label | Beside it           | Always                        |                            |
| "App sessions"   | Tile label | Beside it           | The overview only             |                            |
| "Uses over time" | Card title | Under the tiles     | Always                        |                            |

## How people use the app

On the overview. Each share is a trend tile; the detail is its chart's axis.

| String                                                                                                                      | Kind              | Where                                                        | When                                                        | Review                                                |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------- |
| "How people use the app"                                                                                                    | Section title     |                                                              | Always                                                      |                                                       |
| "Search results" / "Search within a group" / "Browsing a group" / "Favorites list" / "Recently used list" / "Auto Assembly" | Bar labels        | The source breakdown                                         | Always; uses by where they started                          | **⚑** "Auto Assembly" is new                          |
| "No uses recorded yet."                                                                                                     | Empty notice      | In place of the bars                                         | No use in the range                                         | **⚑** Was "No inserts recorded yet."                  |
| "Quick insert" / "% of inserts"                                                                                             | Tile label / axis |                                                              | Always                                                      | **⚑** Measured against inserts, leaving downloads out |
| "Insert and fasten" / "% of assembly inserts"                                                                               | Tile label / axis |                                                              | Always                                                      |                                                       |
| "Into an assembly" / "% of uses"                                                                                            | Tile label / axis | Also on a part's page                                        | Always                                                      | **⚑** Now a share of every use                        |
| "Downloaded" / "% of uses"                                                                                                  | Tile label / axis | Also on a part's page                                        | Always                                                      | **⚑** New                                             |
| "How parts are inserted"                                                                                                    | Card title        | The overview, and a library's page under "How people use it" | Always                                                      | **⚑** New                                             |
| "Insert menu" / "Quick insert" / "Auto Assembly"                                                                            | Bar labels        | That card                                                    | Always; every insert by how it was made, downloads left out | **⚑** New                                             |
| "How insert and fasten parts are placed"                                                                                    | Card title        | Beside it                                                    | Always                                                      | **⚑** New                                             |
| "Inserts into an assembly of a part offering insert and fasten."                                                            | Card description  | Under that title                                             | Always                                                      | **⚑** New                                             |
| "Inserted normally" / "Fastened to preselected edges" / "Auto Assembly"                                                     | Bar labels        | That card                                                    | Always                                                      | **⚑** New                                             |
| "None recorded yet."                                                                                                        | Empty notice      | In place of either card's bars                               | Nothing to split in the range                               | **⚑** New                                             |
| "How people use it"                                                                                                         | Section title     | A library's page, holding the two cards                      | Always                                                      | **⚑** New                                             |

## Parts

| String                                                   | Kind           | Where                       | When                          | Review                                                         |
| -------------------------------------------------------- | -------------- | --------------------------- | ----------------------------- | -------------------------------------------------------------- |
| "Most used parts"                                        | Card title     | A library's page            | Always                        |                                                                |
| "Part" / "Group" / "Uses per month" / "Uses"             | Column headers | The parts table             | Always                        |                                                                |
| "Hidden"                                                 | Badge          | Beside a hidden part's name | The part is hidden from users |                                                                |
| "No parts from this library have been used yet."         | Empty notice   | In place of the table       | Nothing used in the range     | **⚑** Was "No parts have been inserted from this library yet." |
| "No matching part."                                      | Empty notice   | Same                        | The search matches nothing    |                                                                |
| "Search parts…"                                          | Placeholder    | A part's page, the picker   | Always                        |                                                                |
| "This library has no parts."                             | Empty notice   | Under the picker            | The library is empty          |                                                                |
| "Uses per month" / "Uses" / "Unique users" / "Favorites" | Card labels    | A part's page               | Always                        |                                                                |
| "Configuration values"                                   | Heading        | A part's page               | Always                        |                                                                |
| "Usage breakdown"                                        | Card title     | The treemap                 | Always                        |                                                                |
| "All libraries"                                          | Breadcrumb     | Above the treemap           | On the overview               |                                                                |
| "Nothing was used in this range."                        | Empty notice   | In place of the treemap     | No use in the range           | **⚑** Was "Nothing was inserted in this range."                |

## Every section

| String                                    | Kind                   | Where                           | When                                                        | Review    |
| ----------------------------------------- | ---------------------- | ------------------------------- | ----------------------------------------------------------- | --------- |
| "Failed to load analytics."               | Zero state title       | In place of a section's content | Its query failed after two retries; the section title stays | **⚑** New |
| "If the problem persists, send a report." | Zero state description | Under it                        | Same; shared with the app's other section errors            |           |
| "Try again" / "Send a report"             | Buttons                | Under it                        | Same; Try again refetches that section alone                | **⚑** New |

## Version manager

On the overview.

| String                                                 | Kind          | Where       | When   | Review |
| ------------------------------------------------------ | ------------- | ----------- | ------ | ------ |
| "Version manager"                                      | Section title |             | Always |        |
| "Runs" / "Tabs updated" / "Versions created" / "Links" | Tile labels   |             | Always |        |
| "{n} with failures"                                    | Tile caption  | Under Runs  | Always |        |
| "Right now"                                            | Tile caption  | Under Links | Always |        |

## Low usage

| String                                                        | Kind                     | Where                         | When                                 | Review |
| ------------------------------------------------------------- | ------------------------ | ----------------------------- | ------------------------------------ | ------ |
| "Low-usage parts" / "Low-usage configuration options"         | Card titles              |                               | Always                               |        |
| "Every visible part is used more than the threshold."         | Empty notice, check mark | In place of the parts table   | No part at or below the threshold    |        |
| "Every configuration option is used more than the threshold." | Empty notice, check mark | In place of the options table | No option at or below the threshold  |        |
| "Part" / "Parameter" / "Option" / "Uses" / "Share"            | Column headers           | The options table             | Always                               |        |
| "Never used" / "Default"                                      | Badges                   | Beside an option              | Nobody picked it / it is the default |        |

## A part's configuration values

| String                                       | Kind         | Where                        | When                       | Review                                                       |
| -------------------------------------------- | ------------ | ---------------------------- | -------------------------- | ------------------------------------------------------------ |
| "{n} recorded"                               | Caption      | Beside each parameter's name | Always                     |                                                              |
| "Default"                                    | Badge        | Beside the default value     | Always                     |                                                              |
| "This part has no configuration parameters." | Empty notice | In place of the cards        | The part has no parameters | **⚑** Was "This insertable has no configuration parameters." |
