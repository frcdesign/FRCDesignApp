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

| String                                                                                                    | Kind              | Where                 | When                               | Review                                                |
| --------------------------------------------------------------------------------------------------------- | ----------------- | --------------------- | ---------------------------------- | ----------------------------------------------------- |
| "How people use the app"                                                                                  | Section title     |                       | Always                             |                                                       |
| "Search results" / "Search within a group" / "Browsing a group" / "Favorites list" / "Recently used list" | Bar labels        | The source breakdown  | Always; uses by where they started |                                                       |
| "No uses recorded yet."                                                                                   | Notice            | In place of the bars  | No use in the range                | **⚑** Was "No inserts recorded yet."                  |
| "Quick insert" / "% of inserts"                                                                           | Tile label / axis |                       | Always                             | **⚑** Measured against inserts, leaving downloads out |
| "Insert and fasten" / "% of assembly inserts"                                                             | Tile label / axis |                       | Always                             |                                                       |
| "Into an assembly" / "% of uses"                                                                          | Tile label / axis | Also on a part's page | Always                             | **⚑** Now a share of every use                        |
| "Downloaded" / "% of uses"                                                                                | Tile label / axis | Also on a part's page | Always                             | **⚑** New                                             |

## Parts

| String                                                   | Kind           | Where                       | When                          | Review                                                         |
| -------------------------------------------------------- | -------------- | --------------------------- | ----------------------------- | -------------------------------------------------------------- |
| "Most used parts"                                        | Card title     | A library's page            | Always                        |                                                                |
| "Part" / "Group" / "Uses per month" / "Uses"             | Column headers | The parts table             | Always                        |                                                                |
| "Hidden"                                                 | Badge          | Beside a hidden part's name | The part is hidden from users |                                                                |
| "No parts from this library have been used yet."         | Notice         | In place of the table       | Nothing used in the range     | **⚑** Was "No parts have been inserted from this library yet." |
| "No matching part."                                      | Notice         | Same                        | The search matches nothing    |                                                                |
| "Search parts…"                                          | Placeholder    | A part's page, the picker   | Always                        |                                                                |
| "This library has no parts."                             | Notice         | Under the picker            | The library is empty          |                                                                |
| "Uses per month" / "Uses" / "Unique users" / "Favorites" | Card labels    | A part's page               | Always                        |                                                                |
| "Configuration values"                                   | Heading        | A part's page               | Always                        |                                                                |
| "Usage breakdown"                                        | Card title     | The treemap                 | Always                        |                                                                |
| "All libraries"                                          | Breadcrumb     | Above the treemap           | On the overview               |                                                                |
| "Nothing was used in this range."                        | Notice         | In place of the treemap     | No use in the range           | **⚑** Was "Nothing was inserted in this range."                |
