# Feedback and reports

## Purpose

Lets anyone using the app send a report to the FRCDesign Discord without
leaving Onshape: general feedback about the app or a library, an issue with one
part, or an error the app hit. Each report is posted to the topic's Discord
channel with enough about the page and the launch to act on it, and counted for
the dashboard.

It is not a support desk: nothing is stored about a report beyond its counts,
and replies happen only in the report's Discord thread, which the app points
the reporter to once it is sent. So it asks no questions it can't answer: there
is no "question" type. It names the reporter by their Onshape user id, but
sends nothing about their own documents.

## Code map

| Path                                                          | Role                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/backend/features/feedback/contract.ts`                   | Topics, categories, sources and their labels; the request body; a leaf          |
| `src/backend/features/feedback/routes.ts`                     | `POST /api/feedback`                                                            |
| `src/backend/features/feedback/discord-forums.ts`             | The server's invite, and each forum's channel, invite and tag ids; a leaf       |
| `src/backend/features/feedback/channels.ts`                   | Each forum's webhook secret, and `reportTagIds`                                 |
| `src/backend/features/feedback/discord.ts`                    | `buildReportMessage`, `postToDiscord`                                           |
| `src/backend/features/feedback/reported-part.ts`              | `findReportedPart`: the part, its link and its configuration as the reader sees |
| `src/backend/features/feedback/rate-limit.ts`                 | `takeReportSlot`: reports per reporter per hour                                 |
| `src/backend/features/analytics/tracking.ts`                  | `trackReport`, which records each sent report                                   |
| `src/backend/features/analytics/report-queries.ts`            | The dashboard's report counts and most reported parts                           |
| `src/frontend/features/feedback/components/feedback-form.tsx` | The one form every report is sent from                                          |
| `src/frontend/features/feedback/open-feedback.tsx`            | `openFeedbackForm`, `openPartReport`, `openErrorReport`                         |
| `src/frontend/features/feedback/labels.ts`                    | Each topic's and type's message, the description placeholder, `suggestTitle`    |
| `src/frontend/features/feedback/diagnostics.ts`               | `collectDiagnostics`, `toReportedError`                                         |
| `src/frontend/features/feedback/components/report-button.tsx` | **Send a report**, beside an error notice                                       |
| `src/frontend/features/feedback/components/report-sent.tsx`   | What the form becomes once sent: which channel, and **Open Discord**            |
| `src/frontend/lib/errors.ts`                                  | `handleAppError`, `showReportableErrorToast`: the **Report** button on toasts   |
| `src/frontend/features/dashboard/report-summary.tsx`          | The dashboard's **Reports** sections                                            |

## Storage

- **Discord**, not ours: each report is one thread in the topic's forum
  channel.
- **KV** `feedback-sent:` — by reporter (`user:<id>` signed in, `ip:<address>`
  otherwise), the times of their reports in the last hour, for an hour.
- **D1** — one `events` row per sent report (`type` `report`, with
  `report_topic`, `report_category`, `report_source`, and the element columns
  for a part report) and its `daily_report_metrics` rollup; see
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
`broken-configuration`, `thumbnail`, `kudos`, `other`) and
`error-report`. A key with no id is left untagged; `kudos` has none in any
forum yet, and `thumbnail` is offered by no form, kept so past reports keep
their label. A tag id the forum doesn't
have makes Discord refuse the post, which then goes again untagged.

### Where a report starts

The source decides what the form offers and what the report carries
(`feedbackCategories`):

- **General** — **Leave feedback** in settings, which is also the app's way
  into the Discord. The reporter picks the topic.
  The app's topics offer bug, feature request and other; a library's offer
  new part request, search or organization, bug, kudos and other, the kinds its
  forum is tagged by, and the form says that a problem with one part is
  reported from the insert menu.
- **Part** — **Report an issue** in a part's menu, on its card or in the
  insert menu. Until somebody has closed a menu offering it, the item and the
  ⋯ buttons opening it carry the blue dot (`Hint.OPENED_REPORT_ISSUE`). The
  form is titled **Report issue with** the part, and the topic is the part's
  library. It offers missing or incorrect metadata, incorrect geometry, broken
  configuration, bug (a part that won't insert is one) and other, and asks
  whether the problem is in the underlying Onshape document. From the insert
  menu, **Include configuration** (on by default) sends the selection on
  screen; a card's menu has no configuration on screen, so it sends none.
- **Error** — **Report** on an error toast, or **Send a report** under an
  error notice, a failed version run, the cookie error and `/document-access`.
  The report carries what the user was shown and the error behind it, and may
  be sent with nothing typed.

### Sending

1. The form sends `{ topic, category, source, title, message, contact?, part?,
diagnostics }`, where `part` is `{ insertableId, selection?, inDocument }`.
   The title is the reporter's. A part or error report fills it in with
   `suggestTitle` until they write their own: the type and the part ("Broken
   configuration: Hex Shaft"), or the error they were shown. General feedback
   starts with it empty. The contact is a Discord username, if they give one.
2. Diagnostics (`collectDiagnostics`) are gathered as it sends, and never name
   the document the reporter was in: the app's own path
   and params with Onshape's launch params removed, the build id, the kind of
   tab the app was launched in (Part Studio or Assembly, workspace or not, in
   an Enterprise or not), the level the app is viewed as, the window size, and
   the error.
3. `feedbackBody` checks that the category belongs to the topic and source,
   that only a part report names a part, that the title fits a thread's name
   (100 characters), and that only an error report may have no message.
   Diagnostics are clipped to length rather than refused.
4. The route resolves the reporter (a user id when signed in, none otherwise)
   and takes a slot from the rate limit. The post names them by that id, or
   says they weren't signed in.
5. A part report looks the part up in the topic's library (`findReportedPart`),
   runs the selection through `toSelection`, and builds the Onshape link from
   `onshapeOverrides` and the readable `Name: value` lines from the parameters
   the reporter could see. The link is to the library's own document. The post
   says whether the reporter put the problem in the Onshape document.
6. `postToDiscord` posts the embed with `?wait=true`, opening a thread named by
   the title (`thread_name`) under the report's tags (`applied_tags`).
7. Once posted, `trackReport` records it in the background, under the id the
   post quotes in its footer.
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
- A part report names a part in the topic's own library, looked up on the
  server; its configuration is sent as a selection, never as a key.
- A post never gathers the reporter's own documents: no document, workspace,
  element, company or company domain from the launch. An error's detail is
  sent as it came, since what Onshape said is what the team needs, ids and
  all. The part a part report names is the library's, not theirs.
  The reporter is named only by their Onshape user id and what they typed.
- The route works signed out, since signing in is one of the things that breaks.
- Every embed stays within Discord's limits (`buildReportMessage` trims the
  message to fit).

## Failure and recovery

| Failure                         | Result                                        | Recovery                                 |
| ------------------------------- | --------------------------------------------- | ---------------------------------------- |
| Topic's webhook secret unset    | 503: "Reports can't be sent right now…"       | Set the secret                           |
| Discord refuses or is down      | 502; the form stays open with what was typed  | Send again                               |
| More than 10 reports in an hour | 429: "You've sent a lot of reports recently…" | Wait out the hour                        |
| Webhook deleted in Discord      | Every report to that topic fails with 502     | Make a new webhook and update the secret |
| The record fails after the post | The report is in Discord but not counted      | None needed                              |

## Decisions

- **Discord webhooks, not a bot or our own store.** The team already works in
  the FRCDesign Discord; a webhook needs no bot process and no stored reports.
- **One form, three sources.** What a report is about and where it started
  decide the categories and what is attached, so every report reads the same in
  Discord and counts the same on the dashboard.
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
- **The reporter, not their documents.** The user id lets the team tell
  repeat reports from one person apart from many; somebody's own documents are
  theirs, and the team needs the problem, not the files it happened in.
- **Links on cad's domain.** A reporter's company domain means nothing to the
  person reading the report.

_Last reviewed: 2026-10-31_
