# Teams: strings

What [teams.md](../architecture/teams.md) shows a person. They are messages
in `src/frontend/messages/en.json`, keyed `team…`, and the dashboard's
`dashboardFeatureTeam…` and `dashboardSourceTeam…`. The errors are written by
the backend (`features/teams/`), and the app shows them as they come.

## Settings menu

| String                              | Kind              | Where                        | When                                                     | Review    |
| ----------------------------------- | ----------------- | ---------------------------- | -------------------------------------------------------- | --------- |
| "Team"                              | Select label      | The settings menu            | Signed in, on a team                                     | **⚑** New |
| "FRC 254" / "Personal"              | Options           | Team                         | Personal only outside a team's document                  | **⚑** New |
| "Set by this document"              | Description       | Under Team, disabled         | The document's organization registered one of your teams | **⚑** New |
| "Team dashboard" / "Open dashboard" | Row label, button | The settings menu            | On a team                                                | **⚑** New |
| "Organization" / "Register team"    | Row label, button | The settings menu            | Launched from a company's document                       | **⚑** New |
| "Team settings"                     | Section title     | The settings menu            | An admin of the current team                             | **⚑** New |
| "FIRST teams" / "Refresh"           | Row label, button | Admin settings, FRCDesignApp | The owner                                                | **⚑** New |
| "FIRST teams refreshed"             | Success toast     |                              | The refresh finished                                     |           |
| "Failed to switch team"             | Error toast       |                              | Choosing a team failed                                   |           |

## Register team

| String                                                                          | Kind                   | Where            | When                                      | Review          |
| ------------------------------------------------------------------------------- | ---------------------- | ---------------- | ----------------------------------------- | --------------- |
| "Register team"                                                                 | Modal title, button    |                  | Opened from the menu                      | **⚑** New       |
| "Links {organization} to a FIRST team."                                         | Description            | Top of the modal | The organization has a name on record     | **⚑** New       |
| "New team" / "My team"                                                          | Segmented control      | Top of the modal | The caller administers a team             | **⚑** New       |
| "FRC" / "FTC"                                                                   | Segmented control      | New team         | Always                                    |                 |
| "Team" / "Number or name"                                                       | Select label, hint     |                  | Always                                    | **⚑** New       |
| "No team found"                                                                 | Empty dropdown         | Team             | The search matched nothing                |                 |
| "Onshape team"                                                                  | Input label            |                  | Always                                    | **⚑** New       |
| "Only its members join. Leave empty for everyone in the organization."          | Description            | Onshape team     | Always                                    | **⚑** Two ideas |
| "Invalid Onshape team link"                                                     | Input error            | Onshape team     | No team id in what was typed              | **⚑** New       |
| "Team registered" / "Failed to register team"                                   | Success, error toast   |                  | After Register                            |                 |
| "Only an admin of {company} can register it to a team."                         | Error, from the server |                  | The caller doesn't administer the company | **⚑** New       |
| "{company} is already registered." / "That Onshape team is already registered." | Error, from the server |                  | The company or subteam has a team         | **⚑** New       |
| "FIRST doesn't list that team."                                                 | Error, from the server |                  | The number isn't in FIRST's list          | **⚑** New       |
| "That Onshape team isn't in this organization."                                 | Error, from the server |                  | Another company owns the Onshape team     | **⚑** New       |

## Team settings

| String                                                         | Kind                   | Where                   | When                                          | Review    |
| -------------------------------------------------------------- | ---------------------- | ----------------------- | --------------------------------------------- | --------- |
| "Members edit favorites"                                       | Switch label           | Team settings           | Always                                        | **⚑** New |
| "Lets members add, order and remove team favorites."           | Description            | Under the switch        | Always                                        | **⚑** New |
| "Preferred vendors"                                            | Multi-select label     | Team settings           | Always                                        | **⚑** New |
| "In the order picked: first listed first."                     | Description            | Under Preferred vendors | Always                                        | **⚑** New |
| "Generic fasteners"                                            | Select label           | Team settings           | Always                                        | **⚑** New |
| "Whether Auto Assembly uses Generic screws, washers and nuts." | Description            | Under Generic fasteners | Always                                        | **⚑** New |
| "Require" / "Prefer" / "No preference" / "Avoid" / "Ban"       | Options                | Generic fasteners       | Always                                        | **⚑** New |
| "Team colors" / "Add" / "Remove color"                         | Label, button, tooltip | Team settings           | Add while under six colors                    | **⚑** New |
| "Organizations"                                                | Heading                | Team settings           | Always                                        | **⚑** New |
| "{organization}, {n} Onshape team member(s)"                   | Row                    | Under Organizations     | A subteam registration                        | **⚑** New |
| "Refresh members" / "Remove"                                   | Tooltips               | An organization's row   | Refresh only for a subteam                    | **⚑** New |
| "{n} member(s)"                                                | Heading                | Team settings           | Always                                        | **⚑** New |
| "Admin" / "Member"                                             | Options                | A member's role         | Always                                        |           |
| "A team needs an admin."                                       | Error, from the server |                         | The last admin leaves or is demoted           | **⚑** New |
| "Failed to save team settings" / "Failed to update team"       | Error toasts           |                         | A setting, member or organization edit failed |           |

## Favorites, recents and color

| String                                                 | Kind                   | Where                       | When                                       | Review    |
| ------------------------------------------------------ | ---------------------- | --------------------------- | ------------------------------------------ | --------- |
| "Team favorite"                                        | Tooltip                | The team icon on a favorite | A team favorite                            | **⚑** New |
| "Add to team favorites" / "Remove from team favorites" | Menu item              | A part's menu, Favorites    | Allowed to edit team favorites             | **⚑** New |
| "Team favorites"                                       | Menu section           | A team favorite's menu      | Allowed to edit team favorites             | **⚑** New |
| "Your team's admins manage its favorites."             | Error, from the server |                             | A member edits while members can't         | **⚑** New |
| "Failed to update team favorites"                      | Error toast            |                             | An edit failed                             |           |
| "Mine" / "Team"                                        | Segmented control      | Top of Recently Used        | On a team                                  | **⚑** New |
| "Color"                                                | Row label              | Configuration inputs        | A part with color channels or a text color | **⚑** New |
| "Custom"                                               | Option                 | Color                       | On a team with colors                      | **⚑** New |
| "Hex or RGB"                                           | Placeholder            | Color's input               | Custom, or off a team                      | **⚑** New |

## Team page

At `/dashboard/teams/:teamId`.

| String                                         | Kind                   | Where                 | When                                     | Review    |
| ---------------------------------------------- | ---------------------- | --------------------- | ---------------------------------------- | --------- |
| "Sign in to see your team" / "Sign in"         | Notice, button         | The page              | Signed out                               | **⚑** New |
| "Loading team..." / "Failed to load team"      | Loading, error         | The page              |                                          |           |
| "{year}, September to August"                  | Subtitle               | Under the team's name | Always                                   | **⚑** New |
| "Uses" / "Active members"                      | Tile labels            | Top row               | Always                                   |           |
| "All uses"                                     | Card title             | Top row               | Always                                   | **⚑** New |
| "Top {percent}%"                               | Card value             | Each category         | Ten or more teams used it                | **⚑** New |
| "Ranked once {count} teams use it"             | Card value             | Each category         | Fewer than ten teams used it             | **⚑** New |
| "Not used yet"                                 | Card value             | Each category         | The team never used it this year         | **⚑** New |
| "{n} use(s), {perMember} per member"           | Card caption           | Each category         | Always                                   | **⚑** New |
| "Gold" / "Silver" / "Bronze"                   | Badge                  | A category card       | Top 10%, 25%, 50%                        | **⚑** New |
| "Team favorites" / "Team's recently used list" | Feature, source labels | The public dashboard  | Feature usage and How people use the app | **⚑** New |
