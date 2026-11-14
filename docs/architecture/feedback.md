# Feedback and reports

## Purpose

Lets anyone using the app send a report to the FRCDesign Discord without
leaving Onshape: general feedback about the app, a library or the
FeatureScripts, an issue with one part or one FeatureScript, or an error the
app hit. `/feedback` holds the same form as a page of its own, for someone
outside Onshape. Each report is posted to the topic's Discord
channel with enough about the page and the launch to act on it, and counted for
the dashboard.

It is not a support desk: nothing is kept about a report beyond its counts
and a week in the Worker's logs, and replies happen only in the report's
Discord thread, which the app points the reporter to once it is sent. So it asks no questions it can't answer: there
is no "question" type. It says whether the reporter was signed in, but never
who they are beyond what they typed, nor anything about their own documents.

## Code map

| Path                                                                 | Role                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/backend/features/feedback/contract.ts`                          | Topics, categories, sources and their labels; the request body; a leaf               |
| `src/backend/features/feedback/routes.ts`                            | `POST /api/feedback`                                                                 |
| `src/backend/features/feedback/discord-forums.ts`                    | The server's invite, and each forum's channel, invite and tag ids; a leaf            |
| `src/backend/features/feedback/channels.ts`                          | Each forum's webhook secret, and `reportTagIds`                                      |
| `src/backend/features/feedback/discord.ts`                           | `buildReportMessage`, `postToDiscord`                                                |
| `src/backend/features/feedback/reported-part.ts`                     | `findReportedPart`: the part, its link and its configuration as the reader sees      |
| `src/backend/features/feedback/reported-featurescript.ts`            | `findReportedFeatureScript`: the feature, its version and its links                  |
| `src/backend/features/feedback/rate-limit.ts`                        | `takeReportSlot`: reports per reporter per hour                                      |
| `src/backend/features/analytics/tracking.ts`                         | `trackReport`, which records each sent report                                        |
| `src/backend/features/analytics/report-queries.ts`                   | The dashboard's report counts and most reported parts                                |
| `src/frontend/features/feedback/components/feedback-form.tsx`        | The one form every report is sent from                                               |
| `src/frontend/features/feedback/components/featurescript-picker.tsx` | The form's optional **FeatureScript** choice                                         |
| `src/frontend/features/feedback/open-feedback.tsx`                   | `openFeedbackForm`, `openPartReport`, `openFeatureScriptReport`, `openErrorReport`   |
| `src/frontend/routes/feedback.tsx`                                   | `/feedback`: the form as a page, where feedback.frcdesign.org redirects              |
| `src/frontend/features/feedback/labels.ts`                           | Each area's, topic's and type's message, the description placeholder, `suggestTitle` |
| `src/frontend/features/feedback/diagnostics.ts`                      | `collectDiagnostics`, `toReportedError`                                              |
| `src/frontend/features/feedback/crash-report.ts`                     | `useCrashReport`: a crash sent in one click, with no form                            |
| `src/frontend/components/root-error.tsx`                             | The crash pages, `RootCrash` and `RootAppError`, each with **Send report**           |
| `src/frontend/features/feedback/components/report-button.tsx`        | **Send a report**, beside an error notice                                            |
| `src/frontend/features/feedback/components/report-sent.tsx`          | What the form becomes once sent: which channel, and **Open Discord**                 |
| `src/frontend/lib/errors.ts`                                         | `handleAppError`, `showReportableErrorToast`: the **Report** button on toasts        |
| `src/frontend/features/dashboard/report-summary.tsx`                 | The dashboard's **Reports** sections                                                 |

## Storage

- **Discord**, not ours: each report is one thread in the topic's forum
  channel.
- **KV** `feedback-sent:` — by reporter (`user:<id>` signed in, `ip:<address>`
  otherwise), the times of their reports in the last hour, for an hour.
- **Workers Logs** — each report as one `event: "report"` entry: everything
  the post holds, plus the reporter's user id, by the report's `id`, for 7
  days.
- **D1** — one `events` row per sent report (`type` `report`, with
  `report_topic`, `report_category`, `report_source`, `report_team_number`, the
  element columns for a part report, and `feature_type` for one naming a
  FeatureScript) and its `daily_report_metrics` rollup; see
  [analytics.md](./analytics.md).

## Flows

### Topics and forums

Everything about the Discord server that isn't secret, the channels, their
invites and their tag ids, is in `discord-forums.ts` (`DISCORD_FORUMS`), a leaf
the frontend reads too. Only the webhooks, which can post as us, are secrets.

| Topic           | Forum (`DiscordForum`) | Webhook secret                       | Library |
| --------------- | ---------------------- | ------------------------------------ | ------- |
| FRCDesignApp    | `APP`                  | `DISCORD_APP_WEBHOOK_URL`            | —       |
| Version Manager | `APP`                  | `DISCORD_APP_WEBHOOK_URL`            | —       |
| FRCDesignLib    | `LIBRARY`              | `DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL` | its own |
| MKCad           | `LIBRARY`              | `DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL` | its own |
| ConfigLib       | `CONFIG_LIB`           | `DISCORD_CONFIG_LIB_WEBHOOK_URL`     | its own |
| FeatureScripts  | `FEATURESCRIPTS`       | `DISCORD_FEATURESCRIPTS_WEBHOOK_URL` | —       |

Each webhook is a Discord forum channel's, set per environment with
`wrangler secret put` and in `.env` locally. A topic whose webhook is unset
refuses reports with a `handled` 503. Each forum's entry names its `channel`,
an `invite` made from that channel (the server's own, `DISCORD_INVITE_URL`,
when absent) and its `tags`.

### Tags

Each thread is filed under up to three of its forum's tags (`reportTagIds`):
its topic's, its type's, and **Error report** when it started from an error.
The keys are the topic values (`app`, `version-manager`, `frc-design-lib`,
`mkcad`, `config-lib`), the category values (`bug`, `feature-request`,
`part-request`, `organization`, `metadata`, `incorrect-geometry`,
`broken-configuration`, `kudos`, `other`) and
`error-report`. A forum holding one topic, ConfigLib's or FeatureScripts',
has no topic tag, and FeatureScripts' has no **Error report** tag. A key
with no id is left untagged. A tag id the forum doesn't
have makes Discord refuse the post, which then goes again untagged.

### Where a report starts

The source decides what the form offers and what the report carries
(`feedbackCategories`):

- **General** — **Leave feedback** in settings, which is also the app's way
  into the Discord, and the `/feedback` page. The reporter picks the area
  first (`FeedbackArea`: part library, FRCDesignApp, Version Manager or
  FeatureScripts), then under a part library which library (FRCDesignLib to
  start), and under FeatureScripts, optionally, which FeatureScript; that one
  is sent as `featureScript` and the report names it as one from its menu
  does. Changing the area drops the FeatureScript, and keeps the library for
  coming back to. The app's topics and FeatureScripts offer bug, feature request, kudos and other; a library's offer
  new part request, search or organization, bug, kudos and other, the kinds its
  forum is tagged by, and the form says that a problem with one part is
  reported from the insert menu.
- **Part** — **Report an issue** in a part's menu, on its card or in the
  insert menu. Until somebody has closed a menu offering it, the item and the
  ⋯ buttons opening it carry the blue dot (`Hint.OPENED_REPORT_ISSUE`). The
  form is titled **Report issue with** the part, and the topic is the part's
  library. It offers missing or incorrect metadata, incorrect geometry, broken
  configuration, bug (a part that won't insert is one) and other. From the insert
  menu, **Include configuration** (on by default) sends the selection on
  screen; a card's menu has no configuration on screen, so it sends none.
- **FeatureScript** — **Report an issue** in a FeatureScript's ⋯ menu, on its
  row or in its popup. The form is titled **Report issue with** the feature,
  the topic is FeatureScripts and isn't offered, and it offers what the
  FeatureScripts topic does.
- **Error** — **Report** on an error toast, or **Send a report** under an
  error notice, a failed version run, the cookie error and `/document-access`.
  The report carries what the user was shown and the error behind it, and may
  be sent with nothing typed. A failed insert's report also names the part and
  the configuration it was inserted in (`handleAppError`'s `part`), with
  **Include configuration** as in the insert menu, so the post links to that
  configuration in Onshape: a configuration that can't build reads apart from
  Onshape failing. The topic stays the app's, and isn't offered.
- **Crash** — **Send report** on a crash page: `RootCrash`, when the root
  itself fails (the dashboard's pages have no boundary of their own), and
  `RootAppError` under `/app`. One click sends it, with no form, since the root's
  page has nothing to draw one with (`useCrashReport`). It is an error report
  about the app, a bug, titled "Crash: " and the error, carrying the error's
  stack and no message. The page then says where the report went, or why it
  failed and **Try again**; **Open Discord** is the way in when sending can't
  work.

### Sending

1. The form sends `{ topic, category, source, title, message, contact?,
teamNumber?, featureScript?, part?, diagnostics }`, where `part` is
   `{ insertableId, selection? }` and `featureScript` is `{ featureScriptId }`.
   The title is the reporter's. A part, FeatureScript or error report fills it
   in with `suggestTitle` until they write their own: the type and the part or
   feature ("Broken configuration: Hex Shaft"), or the error they were shown. General feedback
   starts with it empty. The contact is a Discord username and the team number
   an FRC or FTC team (a whole number up to `MAX_TEAM_NUMBER`), each only if
   they give one.
2. Diagnostics (`collectDiagnostics`) are gathered as it sends, and never name
   the document the reporter was in: the app's own path
   and params with Onshape's launch params and the `userId` and `clientId` it
   adds removed, the build id, the kind of
   tab the app was launched in (Part Studio or Assembly, workspace or not, in
   an Enterprise or not), the launch context (`LaunchContext`: the panel when the launch
   params name an element, standalone otherwise, by `toLaunchContext`; computed
   here so `/cookie-error`, with no session, still has it), the level the app is viewed as, the window size, and
   the error: what was shown, and for a thrown `Error` its stack
   (`toReportedError`), which a crash report sends too. An `AppError` brings
   its kind and message instead, the request that failed as
   `GET /api/… → 500` (the query left out, since it can name a document), and
   the server's `errorId` when it logged one.
3. `feedbackBody` checks that the category belongs to the topic and source,
   that only a part report names a part, that only a FeatureScripts report
   names a FeatureScript and one from its menu must, that the title fits a thread's name
   (100 characters), and that only an error report may have no message.
   Diagnostics are clipped to length rather than refused.
4. The route resolves the reporter (a user id when signed in, none otherwise)
   and takes a slot from the rate limit. The id goes to the limit, the
   record and the log only; the post says just whether they were signed in.
5. A report naming a part looks it up in the topic's library
   (`findReportedPart`), or in any library for an error report under the app's
   topics (`ANY_LIBRARY`), since the app's forum covers them all. It
   runs the selection through `toSelection`, and builds the Onshape link from
   `onshapeOverrides` and the readable `Name: value` lines from the parameters
   the reporter could see. The link is to the library's own document. The post
   says whether the reporter put the problem in the Onshape document.
   A report naming a FeatureScript looks it up among those loaded
   (`findReportedFeatureScript`), and refuses with a 404 one that isn't. The
   post names it with its version and links its Feature Studio in the loaded
   frontend version, and its source when it has one.
6. The report is logged, then `postToDiscord` posts the message with
   `?wait=true`, opening a thread named by the title (`thread_name`) under the report's tags (`applied_tags`). The
   message is two embeds: the report in its type's color (title, link to the
   part, what they typed, then the part, its configuration, the error (with its
   request and error id), the Discord username and the team number), and
   under it a gray
   block of `Label: value` lines (topic, type, source, page, launch, launch context, signed in, access
   level (per library from the server, one level when they agree, and the
   level viewed at when someone chose one), cookies (names only), build, window,
   browser) with the report id in its footer.
7. Once posted, `trackReport` records it in the background, under the id the
   post quotes in its footer, with the team number when there is one and the
   feature's type when it names a FeatureScript.
8. The form turns into a success notice (`ReportSent`, a `SectionNotice`):
   "Report sent!", "You can find your report in #frcdesignlib-feedback if you want
   to follow up in Discord.", and **Open Discord**, the forum's invite
   (`forumInvite`). Replies happen only there. If anything failed, the form
   stays open with the error and what was typed.

### The dashboard

The overview's **Reports** section counts every topic's reports over the
range: the total, those from errors, those about a part, and a table by topic
and type. A library's page shows its own topic's, and its ten most reported
parts still in the library, each opening the part's page.

## Invariants

- A report reaches Discord before it is recorded; a failed post records
  nothing, and a failed record never fails the report.
- Text a reporter typed can never mention anyone (`allowed_mentions` is empty).
- A report names a part in the topic's own library, or any library for an
  error report under the app's topics, looked up on the server; its
  configuration is sent as a selection, never as a key. Only part and error
  reports name one.
- A report names a FeatureScript only under the FeatureScripts topic, and only
  one that is loaded, looked up on the server.
- A post never gathers the reporter's own documents: no document, workspace,
  element, company or company domain from the launch. An error's detail is
  sent as it came, since what Onshape said is what the team needs, ids and
  all. The part a part report names is the library's, not theirs.
- A post names the reporter only by what they typed. Their Onshape user id
  goes to the rate limit, the record and the log, never to Discord.
- The route works signed out, since signing in is one of the things that breaks.
- Every message stays within Discord's limits (`buildReportMessage` trims what
  the reporter typed to fit).

## Failure and recovery

| Failure                            | Result                                        | Recovery                                 |
| ---------------------------------- | --------------------------------------------- | ---------------------------------------- |
| Topic's webhook secret unset       | 503: "Reports can't be sent right now…"       | Set the secret                           |
| Discord refuses or is down         | 502; the form stays open with what was typed  | Send again                               |
| A named FeatureScript isn't loaded | 404; the form stays open                      | Reload FeatureScripts, or pick none      |
| More than 10 reports in an hour    | 429: "You've sent a lot of reports recently…" | Wait out the hour                        |
| Webhook deleted in Discord         | Every report to that topic fails with 502     | Make a new webhook and update the secret |
| The record fails after the post    | The report is in Discord but not counted      | None needed                              |

## Decisions

- **Discord webhooks, not a bot or our own store.** The team already works in
  the FRCDesign Discord; a webhook needs no bot process and no stored reports.
- **One form, three sources.** What a report is about and where it started
  decide the categories and what is attached, so every report reads the same in
  Discord and counts the same on the dashboard.
- **The area first.** Reporters took FRCDesignApp for its libraries when both
  were one list of topics, so the form asks the broad area, then narrows to a
  library or a FeatureScript.
- **FeatureScripts in a forum of their own.** They are a different audience
  and backlog from the app's, and one topic, so the forum needs no topic tag.
- **`/feedback` in the app, behind a redirect.** feedback.frcdesign.org is a
  Cloudflare redirect rule to app.frcdesign.org/feedback, so the page is the
  same form and Worker as the panel's, with nothing to deploy apart.
- **Signed out may report, rate-limited by address.** A sign-in that fails is
  exactly when a report is wanted; the limit bounds what an open endpoint can
  post. KV's lag lets two reports at the same moment both pass, which is fine
  for a limit this loose.
- **Forum channels only.** Each report gets its own thread to be discussed in,
  so every post names one. A webhook on a plain text channel is not supported:
  Discord documents `thread_name` only for forum and media channels.
- **Discord's ids in code.** A webhook can't read its forum's tags or make an
  invite; only a bot can. Channels, invites and tag ids change only when the
  server does, and aren't secret (an id is useless without the webhook), so they
  live in one file beside the code that uses them. A wrong tag id costs the
  tags rather than the report. Every environment shares them: a test webhook in
  a test forum gets its reports untagged.
- **Follow up in Discord, not in the app.** There is nowhere in the app to
  answer a reporter, so the app names the thread and sends them to its forum.
- **An invite per forum, not a link to the thread.** A thread's link opens
  only for somebody already in the server. An invite made by hand from the
  forum works for both, so the app names the channel and offers that one
  button.
- **What they typed, not who they are.** The forum is read by more than the
  team, and a user id in it says nothing a reader can act on. Whether the
  reporter was signed in is what matters for a sign-in problem; a reporter who
  wants an answer gives a Discord username. The dashboard still counts by user
  id, which stays in D1. Somebody's own documents are theirs, and the team
  needs the problem, not the files it happened in.
- **The report first, its details after.** A Discord embed can't collapse, so
  the details go in a second, gray embed under the report, as compact lines in
  one block rather than a grid of fields.
- **Kudos.** Praise goes to the same forum as everything else, under its own
  tag, so the team sees what works as well as what breaks.
- **A week in Workers Logs, not a store of our own.** Each report and each
  server error is already in the Worker's logs, which keep 7 days and are
  queried by id from the dashboard or the Workers Observability API, so a
  report can be read back without Discord. A report quotes the failed
  request's Ray ID rather than carrying the server's stack: the stack stays
  out of the user's browser, and the logs have it under that id.
- **Links on cad's domain.** A reporter's company domain means nothing to the
  person reading the report.

_Last reviewed: 2026-10-31_
