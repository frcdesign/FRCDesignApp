# Teams: strings

What [teams.md](../architecture/teams.md) shows a person. **Proposed**: none of
these exist yet. They will be messages in `src/frontend/messages/en.json`,
keyed `team…`.

## Settings menu

| String                      | Kind             | Where                    | When                                                        | Review    |
| --------------------------- | ---------------- | ------------------------ | ----------------------------------------------------------- | --------- |
| "Team"                      | Menu label       | The settings menu        | Signed in, on at least one team                             | **⚑** New |
| "{program} {number} {name}" | Menu item        | Under Team, one per team | Each of the caller's teams; a check marks the current one   | **⚑** New |
| "Personal"                  | Menu item        | Under Team, last         | Always, under Team                                          | **⚑** New |
| "Set by this document"      | Item description | Under the current team   | The open document belongs to a team                         | **⚑** New |
| "Register your team"        | Menu item        | The settings menu        | Launched from an organization's document that no team holds | **⚑** New |
| "Team settings"             | Menu item        | The settings menu        | A team admin                                                | **⚑** New |

## Registering

| String                                     | Kind         | Where                 | When                        | Review    |
| ------------------------------------------ | ------------ | --------------------- | --------------------------- | --------- |
| "Register your team"                       | Dialog title |                       | Opened from the menu        | **⚑** New |
| "Links {organization} to your FIRST team." | Description  | Under the title       | Always                      | **⚑** New |
| "Team"                                     | Input label  | Search by number/name | Always                      | **⚑** New |
| "Register"                                 | Button       |                       | A team is picked            |           |
| "No team found"                            | Empty state  | Under the input       | The search matches nothing  |           |
| "Already registered"                       | Error toast  |                       | The organization has a team | **⚑** New |
| "Failed to register team"                  | Error toast  |                       | Any other failure           |           |

## Team settings

| String                                       | Kind          | Where                          | When                                 | Review    |
| -------------------------------------------- | ------------- | ------------------------------ | ------------------------------------ | --------- |
| "Members edit favorites"                     | Switch label  | Team settings                  | Always                               | **⚑** New |
| "Lets members add and order team favorites." | Description   | Under the switch               | Always                               | **⚑** New |
| "Preferred vendors"                          | List label    | Team settings, a sortable list | Always                               | **⚑** New |
| "Team colors"                                | Input label   | Team settings, swatches        | Always                               | **⚑** New |
| "Organizations"                              | Section title | Team settings                  | Always                               | **⚑** New |
| "Members"                                    | Section title | Team settings                  | Always                               | **⚑** New |
| "Make admin" / "Make member" / "Remove"      | Menu items    | A member's row                 | Always                               | **⚑** New |
| "A team needs an admin"                      | Error toast   |                                | The last admin is demoted or removed | **⚑** New |

## Favorites and recents

| String                       | Kind              | Where                       | When                                              | Review    |
| ---------------------------- | ----------------- | --------------------------- | ------------------------------------------------- | --------- |
| "Team favorite"              | Tooltip           | The team icon on a favorite | A team favorite                                   | **⚑** New |
| "Add to team favorites"      | Menu item         | A part's menu               | Allowed to edit team favorites                    | **⚑** New |
| "Remove from team favorites" | Menu item         | A team favorite's menu      | Allowed to edit team favorites                    | **⚑** New |
| "Mine" / "Team"              | Segmented control | Recently Used's header      | On a team                                         | **⚑** New |
| "Team colors"                | Label             | Above a color's inputs      | A part with color channels, on a team with colors | **⚑** New |

## Dashboard

| String                       | Kind        | Where                     | When                    | Review    |
| ---------------------------- | ----------- | ------------------------- | ----------------------- | --------- |
| "Teams"                      | Page title  | `/dashboard/teams`        | Always                  | **⚑** New |
| "{rank} of {count} teams"    | Table cell  | A team's row in a feature | Always                  | **⚑** New |
| "Gold" / "Silver" / "Bronze" | Badge       | Beside the rank           | The team earned a medal | **⚑** New |
| "{count} active members"     | Stat tile   | A team's page             | Always                  | **⚑** New |
| "No teams yet this season"   | Empty state | A feature's table         | No team used it         |           |
