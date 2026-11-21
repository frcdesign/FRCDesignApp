# Teams: strings

What [teams.md](../architecture/teams.md) shows a person. They are messages
in `src/frontend/messages/en.json`, keyed `team…`, and the dashboard's
`dashboardFeatureTeam…` and `dashboardSourceTeam…`. The errors are written by
the backend (`features/teams/`), and the app shows them as they come.

## Team panel

Opened by **Team**, beside settings in the navbar.

| String                                    | Kind                        | Where                        | When                                                     | Review    |
| ----------------------------------------- | --------------------------- | ---------------------------- | -------------------------------------------------------- | --------- |
| "Team"                                    | Button tooltip, modal title | The navbar                   | Signed in                                                | **⚑** New |
| "Team"                                    | Select label                | The Team panel               | On a team                                                | **⚑** New |
| "FRC 254 The Cheesy Poofs" / "Personal"   | Options                     | Team                         | Personal only outside a team's document                  | **⚑** New |
| "Set by this document"                    | Description                 | Under Team, disabled         | The document's organization registered one of your teams | **⚑** New |
| "Team dashboard" / "Open dashboard"       | Row label, button           | The Team panel               | On a team                                                | **⚑** New |
| "Organization" / "Register team"          | Row label, button           | The Team panel               | Launched from a company's document                       | **⚑** New |
| "Joined the team" / "Failed to join team" | Toasts                      |                              | Opening an invite link                                   | **⚑** New |
| "This invite has expired."                | Error, from the server      |                              | An invite link past `INVITE_DAYS`                        | **⚑** New |
| "FIRST teams" / "Refresh"                 | Row label, button           | Admin settings, FRCDesignApp | The owner                                                | **⚑** New |
| "FIRST teams refreshed"                   | Success toast               |                              | The refresh finished                                     |           |
| "Failed to switch team"                   | Error toast                 |                              | Choosing a team failed                                   |           |

## Register team

| String                                                                          | Kind                   | Where            | When                                                         | Review          |
| ------------------------------------------------------------------------------- | ---------------------- | ---------------- | ------------------------------------------------------------ | --------------- |
| "Register team"                                                                 | Modal title, button    |                  | From the Team panel, or by Team itself for a company's admin | **⚑** New       |
| "Links {organization} to a FIRST team."                                         | Description            | Top of the modal | The organization has a name on record                        | **⚑** New       |
| "New team" / "Add another team"                                                 | Segmented control      | Top of the modal | The caller is on a team                                      | **⚑** New       |
| "FRC" / "FTC"                                                                   | Segmented control      | New team         | Always                                                       |                 |
| "Team" / "Number or name"                                                       | Select label, hint     |                  | Always                                                       | **⚑** New       |
| "No team found"                                                                 | Empty dropdown         | Team             | The search matched nothing                                   |                 |
| "Onshape team"                                                                  | Input label            |                  | Always                                                       | **⚑** New       |
| "Only its members join. Leave empty for everyone in the organization."          | Description            | Onshape team     | Always                                                       | **⚑** Two ideas |
| "Invalid Onshape team link"                                                     | Input error            | Onshape team     | No team id in what was typed                                 | **⚑** New       |
| "Team registered" / "Failed to register team"                                   | Success, error toast   |                  | After Register                                               |                 |
| "Only an admin of {company} can register it to a team."                         | Error, from the server |                  | The caller doesn't administer the company                    | **⚑** New       |
| "{company} is already registered." / "That Onshape team is already registered." | Error, from the server |                  | The company or subteam has a team                            | **⚑** New       |
| "FIRST doesn't list that team."                                                 | Error, from the server |                  | The number isn't in FIRST's list                             | **⚑** New       |
| "That Onshape team isn't in this organization."                                 | Error, from the server |                  | Another company owns the Onshape team                        | **⚑** New       |

## Team settings

In the Team panel, for an admin of the current team.

| String                                                                 | Kind                                 | Where                   | When                                          | Review    |
| ---------------------------------------------------------------------- | ------------------------------------ | ----------------------- | --------------------------------------------- | --------- |
| "Team settings"                                                        | Divider                              | The Team panel          | Always                                        | **⚑** New |
| "Edit favorites" / "Everyone" / "Admins only"                          | Select label, options                | Team settings           | Always                                        | **⚑** New |
| "Generic vendor"                                                       | Select label                         | Team settings           | Always                                        | **⚑** New |
| "Require" / "Prefer" / "No preference" / "Avoid" / "Ban"               | Options                              | Generic vendor          | Always                                        | **⚑** New |
| "Preferred vendors"                                                    | Multi-select label                   | Team settings           | Always                                        | **⚑** New |
| "In the order picked: first listed first."                             | Description                          | Under Preferred vendors | Always                                        | **⚑** New |
| "Team colors" / "Name" / "Hex or RGB" / "Add" / "Remove color"         | Label, placeholders, button, tooltip | Team settings           | Add while under six colors                    | **⚑** New |
| "Organizations"                                                        | Heading                              | Team settings           | Always                                        | **⚑** New |
| "{organization}, {n} Onshape team member(s)"                           | Row                                  | Under Organizations     | A subteam registration                        | **⚑** New |
| "Refresh members" / "Remove"                                           | Tooltips                             | An organization's row   | Refresh only for a subteam                    | **⚑** New |
| "{n} member(s), {m} admin(s)"                                          | Heading                              | Team settings           | Always                                        | **⚑** New |
| "Admins of your organizations or Onshape teams are the team's admins." | Note                                 | Under the counts        | Always                                        | **⚑** New |
| "Add member"                                                           | Button                               | Under the note          | Always                                        | **⚑** New |
| "Invite link" / "Works until {date}" / "Copy link" / "Copied"          | Input label, description, tooltips   | In place of Add member  | Once made                                     | **⚑** New |
| "Failed to save team settings" / "Failed to update team"               | Error toasts                         |                         | A setting, member or organization edit failed |           |

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

| String                                         | Kind                   | Where                            | When                                     | Review    |
| ---------------------------------------------- | ---------------------- | -------------------------------- | ---------------------------------------- | --------- |
| "Sign in to see your team" / "Sign in"         | Notice, button         | The page                         | Signed out                               | **⚑** New |
| "Loading team..." / "Failed to load team"      | Loading, error         | The page                         |                                          |           |
| "{year}, September to August"                  | Subtitle               | Under the team's name            | Always                                   | **⚑** New |
| "Uses" / "Active members"                      | Tile labels            | Top row                          | Always                                   |           |
| "All uses"                                     | Card title             | Top row                          | Always                                   | **⚑** New |
| "Top {percent}%"                               | Card value             | Each category                    | Ten or more teams used it                | **⚑** New |
| "Ranked once {count} teams use it"             | Card value             | Each category                    | Fewer than ten teams used it             | **⚑** New |
| "Not used yet"                                 | Card value             | Each category                    | The team never used it this year         | **⚑** New |
| "{n} use(s), {perMember} per member"           | Card caption           | Each category                    | Always                                   | **⚑** New |
| "Gold" / "Silver" / "Bronze"                   | Medal icon tooltip     | A category card's corner         | Top 10%, 25%, 50%                        | **⚑** New |
| "Your team" / "Others"                         | Chart legend           | A ranked category's distribution | Ranked                                   | **⚑** New |
| "Teams" / "Uses per member"                    | Chart tooltip          | A ranked category's distribution | Hovering a bar                           | **⚑** New |
| "Team favorites" / "Team's recently used list" | Feature, source labels | The public dashboard             | Feature usage and How people use the app | **⚑** New |
