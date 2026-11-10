# Analytics and the dashboard: strings

What [analytics.md](../architecture/analytics.md) shows on the public
dashboard. Messages are keyed `dashboard…` in `src/frontend/messages/en.json`;
the reports' own strings are in [feedback.md](./feedback.md). Listed so far: the
usage numbers, charts and tables; the rest join as their strings move into the
catalog. A **use** is an insert or a download.

## Headline tiles

| String                                    | Kind           | Where                          | When                                                                | Review                                      |
| ----------------------------------------- | -------------- | ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------- |
| "Total uses"                              | Tile label     | First headline tile            | Always; inserts and downloads                                       | **⚑** Now counts downloads                  |
| "Total users"                             | Tile label     | Beside it                      | Always                                                              |                                             |
| "Uses per user"                           | Tile label     | Beside it                      | Always                                                              |                                             |
| "App sessions"                            | Tile label     | Beside it                      | The overview only                                                   |                                             |
| "vs last season" / "vs previous {n} days" | Change caption | Under a headline tile's change | All time / any shorter range; built in `growth.ts`, not the catalog | **⚑** New: shorter ranges now show a change |
| "Uses over time"                          | Card title     | Under the tiles                | Always                                                              |                                             |

## How people use the app

On the overview: where uses started, over the range.

| String                                                                                                                      | Kind             | Where                                                                      | When                                    | Review                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| "How people use the app"                                                                                                    | Section title    |                                                                            | Always                                  |                                                  |
| "Search results" / "Search within a group" / "Browsing a group" / "Favorites list" / "Recently used list" / "Auto Assembly" | Bar labels       | The source breakdown                                                       | Always; uses by where they started      |                                                  |
| "Not recorded (legacy data)"                                                                                                | Bar label        | The source breakdown                                                       | The range reaches imported history      | **⚑** Was "Not recorded (before September 2026)" |
| "No uses recorded yet."                                                                                                     | Empty notice     | In place of the bars                                                       | No use in the range                     | **⚑** Was "No inserts recorded yet."             |
| "Into an assembly"                                                                                                          | Card label       | A part's page                                                              | Always                                  | **⚑** No longer a tile on the overview           |
| "How parts are inserted"                                                                                                    | Card title       | Under the source breakdown, and a library's page under "How people use it" | Always                                  |                                                  |
| "Insert menu" / "Quick insert" / "Auto Assembly"                                                                            | Bar labels       | That card                                                                  | Always; every insert by how it was made |                                                  |
| "How insert and fasten parts are placed"                                                                                    | Card title       | Beside it                                                                  | Always                                  |                                                  |
| "Inserts into an assembly of a part offering insert and fasten."                                                            | Card description | Under that title                                                           | Always                                  |                                                  |
| "Inserted normally" / "Fastened to preselected edges" / "Auto Assembly"                                                     | Bar labels       | That card                                                                  | Always                                  |                                                  |
| "None recorded yet."                                                                                                        | Empty notice     | In place of either card's bars                                             | Nothing to split in the range           |                                                  |
| "How people use it"                                                                                                         | Section title    | A library's page, holding the two cards                                    | Always                                  |                                                  |

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

## Health

What a library holds and how clean it is, standing now: on a library's page,
and every library's together on the overview.

| String                                  | Kind          | Where                             | When                       | Review                                    |
| --------------------------------------- | ------------- | --------------------------------- | -------------------------- | ----------------------------------------- |
| "Libraries"                             | Section title | The overview                      | Always                     | **⚑** New                                 |
| "Parts" / "Part Studios" / "Assemblies" | Tile labels   | First row                         | Always; visible parts only | **⚑** Part Studios and Assemblies are new |
| "{share} of parts"                      | Tile caption  | Under Part Studios and Assemblies | Always                     | **⚑** New                                 |
| "Healthy" / "Errors" / "Warnings"       | Tile labels   | Second row                        | Always                     |                                           |

## Every section

| String                                    | Kind                   | Where                           | When                                                        | Review    |
| ----------------------------------------- | ---------------------- | ------------------------------- | ----------------------------------------------------------- | --------- |
| "Failed to load analytics."               | Zero state title       | In place of a section's content | Its query failed after two retries; the section title stays | **⚑** New |
| "If the problem persists, send a report." | Zero state description | Under it                        | Same; shared with the app's other section errors            |           |
| "Try again" / "Send a report"             | Buttons                | Under it                        | Same; Try again refetches that section alone                | **⚑** New |

## Overview ranges

| String                            | Kind              | Where                                                                                   | When                          | Review                                                                    |
| --------------------------------- | ----------------- | --------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------- |
| "All time" / "Last {days} days"   | Caption           | Beside Overall / every other overview section's title but the two charts' and Libraries | Always; 30 days               | **⚑** New                                                                 |
| "All time" / "1 year" / "90 days" | Segmented control | Beside Uses over time; under Feature usage's title                                      | Always; 90 days unless chosen | **⚑** New; not yet in the catalog, as the navbar's picker's labels aren't |

## Feature usage

On the overview: one small chart per feature, each week's share of active users
who used it, or for search, STEP downloads and reports how many did, with its
nudges marked.

| String                                                                                                                                                                                                                                                                 | Kind              | Where                                                                 | When                                                       | Review                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| "Feature usage"                                                                                                                                                                                                                                                        | Section title     |                                                                       | Always                                                     | **⚑** New; code calls it feature reach           |
| "Version Manager" / "Insert location" / "Default configuration" / "Report an issue" / "Quick insert" / "Search" / "Favorites list" / "Recently used list" / "Insert and fasten" / "Fasten to preselected edges" / "Auto Assembly" / "STEP download" / "FeatureScripts" | Chart titles      | Each feature's card                                                   | Always                                                     | **⚑** New                                        |
| "Latest week: {value}", the value "18.0%" or "{count} user(s)"                                                                                                                                                                                                         | Caption           | Beside a card's title                                                 | The feature has a recorded use                             | **⚑** New                                        |
| "No recorded use yet."                                                                                                                                                                                                                                                 | Empty notice      | In place of a card's chart                                            | Nobody has used the feature, all time                      | **⚑** New                                        |
| "Blue dot" / "Blue dot removed" / "Tip" / "Tip removed"                                                                                                                                                                                                                | Marker labels     | On a dashed line in a chart                                           | A nudge for the feature shipped or was withdrawn that week | **⚑** New; a week with two joins them with " · " |
| "Week of {week}"                                                                                                                                                                                                                                                       | Tooltip title     | Hovering a chart                                                      | Always                                                     | **⚑** New                                        |
| "{users} of {activeUsers} active user(s)"                                                                                                                                                                                                                              | Tooltip line      | Under a share                                                         | A chart of shares                                          | **⚑** New                                        |
| "All users" / "New vs existing"                                                                                                                                                                                                                                        | Segmented control | Beside the description                                                | Always                                                     | **⚑** New                                        |
| "Existing users" / "New users"                                                                                                                                                                                                                                         | Legend            | Under the description; also the line names                            | New vs existing                                            | **⚑** New                                        |
| "Existing users: {value}" / "New users: {value}"                                                                                                                                                                                                                       | Tooltip lines     | Hovering a chart; a share's each above its "{users} of {activeUsers}" | New vs existing, in a week the split is known              | **⚑** New                                        |
| "Loading feature usage..."                                                                                                                                                                                                                                             | Loading           | Under the section's controls                                          | Loading                                                    | **⚑** New                                        |

## Version Manager

On the overview.

| String                                                 | Kind          | Where       | When   | Review                      |
| ------------------------------------------------------ | ------------- | ----------- | ------ | --------------------------- |
| "Version Manager"                                      | Section title |             | Always | **⚑** Was "Version manager" |
| "Runs" / "Tabs updated" / "Versions created" / "Links" | Tile labels   |             | Always |                             |
| "Right now"                                            | Tile caption  | Under Links | Always |                             |

## Design Check

On the overview. An issue type's name is the one the Design Check page uses;
see [design-check.md](./design-check.md).

| String                                   | Kind          | Where                   | When                            | Review    |
| ---------------------------------------- | ------------- | ----------------------- | ------------------------------- | --------- |
| "Design Check"                           | Section title |                         | Always                          | **⚑** New |
| "Checks" / "Came back clean"             | Tile labels   |                         | Always                          | **⚑** New |
| "{n} in Part Studios, {n} in assemblies" | Tile caption  | Under Checks            | Always                          | **⚑** New |
| "Most found" / "Checks"                  | Column titles | The issue types' table  | A check in the range found any  | **⚑** New |
| "No issues found in this range."         | Empty notice  | In place of the table   | No check in the range found any | **⚑** New |
| "Loading design checks..."               | Loading       | In place of the section | Its query is loading            | **⚑** New |

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
