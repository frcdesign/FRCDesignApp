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
is no "question" type. And it carries nothing that identifies the reporter or
their documents.

## Code map

| Path                                                          | Role                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/backend/features/feedback/contract.ts`                   | Topics, categories, sources and their labels; the request body; a leaf          |
| `src/backend/features/feedback/routes.ts`                     | `POST /api/feedback`                                                            |
| `src/backend/features/feedback/channels.ts`                   | Each topic's webhook, and its forum's name, invite and tags                     |
| `src/backend/features/feedback/discord.ts`                    | `buildReportMessage`, `postToDiscord`                                           |
| `src/backend/features/feedback/reported-part.ts`              | `findReportedPart`: the part, its link and its configuration as the reader sees |
| `src/backend/features/feedback/rate-limit.ts`                 | `takeReportSlot`: reports per reporter per hour                                 |
| `src/backend/features/analytics/tracking.ts`                  | `trackReport`, which records each sent report                                   |
| `src/backend/features/analytics/report-queries.ts`            | The dashboard's report counts and most reported parts                           |
| `src/frontend/features/feedback/components/feedback-form.tsx` | The one form every report is sent from                                          |
| `src/frontend/features/feedback/open-feedback.tsx`            | `openFeedbackForm`, `openPartReport`, `openErrorReport`                         |
| `src/frontend/features/feedback/diagnostics.ts`               | `collectDiagnostics`, `toReportedError`                                         |
| `src/frontend/features/feedback/components/report-button.tsx` | **Send a report**, beside an error notice                                       |
| `src/frontend/features/feedback/components/report-sent.tsx`   | What the form becomes once sent: where the thread is, and **Open in Discord**   |
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

| Topic           | Webhook (secret)                     | Forum settings (var)           | Library |
| --------------- | ------------------------------------ | ------------------------------ | ------- |
| FRCDesignApp    | `DISCORD_APP_WEBHOOK_URL`            | `DISCORD_APP_FORUM`            | —       |
| Version Manager | `DISCORD_APP_WEBHOOK_URL`            | `DISCORD_APP_FORUM`            | —       |
| FRCDesignLib    | `DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL` | `DISCORD_FRC_DESIGN_LIB_FORUM` | its own |
| MKCad           | `DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL` | `DISCORD_FRC_DESIGN_LIB_FORUM` | its own |
| ConfigLib       | `DISCORD_CONFIG_LIB_WEBHOOK_URL`     | `DISCORD_CONFIG_LIB_FORUM`     | its own |

Each webhook is a Discord forum channel's, set per environment with
`wrangler secret put` and in `.env` locally. A topic whose webhook is unset
refuses reports with a `handled` 503.

A forum's settings aren't secret, so they sit in each environment's `vars` in
`wrangler.jsonc` (or as JSON text in `.env`), parsed by `getChannel`:

```jsonc
"DISCORD_APP_FORUM": {
    "name": "app-feedback",                  // the channel, as the reporter is told it
    "invite": "https://discord.gg/…",        // an invite made from that channel
    "tags": { "bug": "1234…", "error-report": "…" }
}
```

Every field may be left out. A value that doesn't parse is ignored and logged.

### Tags

Each thread is filed under up to three of its forum's tags (`reportTagKeys`):
its topic's, its type's, and **Error report** when it started from an error.
The keys are the topic values (`app`, `version-manager`, `frc-design-lib`,
`mkcad`, `config-lib`), the category values (`bug`, `feature-request`,
`part-request`, `organization`, `metadata`, `incorrect-part`,
`broken-configuration`, `insert-failed`, `thumbnail`, `other`) and
`error-report`. A key with no id is left untagged. A tag id the forum doesn't
have makes Discord refuse the post, which then goes again untagged.

### Where a report starts

The source decides what the form offers and what the report carries
(`feedbackCategories`):

- **General** — **Send feedback** in settings. The reporter picks the topic.
  The app's topics offer bug, feature request and other; a library's
  offer new part request, search or organization, bug, feature request and other,
  and the form says that a problem with one part is reported from its menu.
- **Part** — **Report an issue** in a part's menu, on its card or in the
  insert menu. The topic is the part's library. It offers missing or incorrect
  metadata, incorrect part, broken configuration, insert fails, wrong or
  missing thumbnail, and other, and **Include the configuration** (on by
  default) sends the selection on screen.
- **Error** — **Report** on an error toast, or **Send a report** under an
  error notice, a failed version run, the cookie error and `/document-access`.
  The report carries what the user was shown and the error behind it, and may
  be sent with nothing typed.

### Sending

1. The form sends `{ topic, category, source, title, message, contact?, part?,
diagnostics }`. The title is the reporter's, filled in with `suggestTitle`
   until they write their own: the type and the part or topic ("Broken
   configuration: Hex Shaft"), or the error they were shown. The contact is a
   Discord username, if they give one.
2. Diagnostics (`collectDiagnostics`) are gathered as it sends, and say nothing
   about who sent the report or which document they were in: the app's own path
   and params with Onshape's launch params removed, the build id, the kind of
   tab the app was launched in (Part Studio or Assembly, workspace or not, in
   an Enterprise or not), the level the app is viewed as, the window size, and
   the error.
3. `feedbackBody` checks that the category belongs to the topic and source,
   that only a part report names a part, that the title fits a thread's name
   (100 characters), and that only an error report may have no message.
   Diagnostics are clipped to length rather than refused.
4. The route resolves the reporter (a user id when signed in, none otherwise)
   and takes a slot from the rate limit. The id goes no further than the limit
   and the dashboard's count: the post says only whether they were signed in.
5. A part report looks the part up in the topic's library (`findReportedPart`),
   runs the selection through `toSelection`, and builds the Onshape link from
   `onshapeOverrides` and the readable `Name: value` lines from the parameters
   the reporter could see. The link is to the library's own document.
6. `buildReportMessage` replaces any Onshape id (24 hex digits) in the error and
   the page with `<id>` (`redactIds`), for an id the client couldn't strip, such
   as one in an Onshape error message.
7. `postToDiscord` posts the embed with `?wait=true`, opening a thread named by
   the title (`thread_name`) under the report's tags (`applied_tags`).
8. Once posted, `trackReport` records it in the background, under the id the
   post quotes in its footer.
9. The form turns into "Report sent. Thank you!" (`ReportSent`), naming the
   thread and its channel ("posted as **Hex Shaft length** in **#library-feedback**")
   with **Open in Discord**, the forum's invite (the server's own when the forum
   has none). Replies happen only there. If anything failed, the form stays open
   with the error and what was typed.

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
- A post carries nothing that identifies the reporter or their documents: no
  user id, name, email, company or document id, and Onshape ids in free text
  are redacted. The only identity in it is what the reporter typed. The part a
  part report names is the library's, not theirs.
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
- **Tag ids in configuration.** A webhook can't read its forum's tags; only a
  bot can. So ids are set per environment in `wrangler.jsonc`, by keys the code
  owns, and a wrong one costs the tags rather than the report. They aren't
  secret: an id is useless without the webhook.
- **Follow up in Discord, not in the app.** There is nowhere in the app to
  answer a reporter, so the app names the thread and sends them to its forum.
- **An invite per forum, not a link to the thread.** A webhook can't create an
  invite, and a thread's link opens only for somebody already in the server.
  An invite made by hand from the forum works for both, so the app names the
  thread and offers that one button.
- **No identity in the post.** Reports are read by whoever is in the channel;
  the team needs the problem, not the person. Who reported is kept only where
  it does a job: the hour's rate limit, and the analytics event behind the
  dashboard's count.
- **Links on cad's domain.** A reporter's company domain means nothing to the
  person reading the report.

_Last reviewed: 2026-10-31_
