# Feedback and reports

## Purpose

Lets anyone using the app send a report to the FRCDesign Discord without
leaving Onshape: general feedback about the app or a library, an issue with one
part, or an error the app hit. Each report is posted to the topic's Discord
channel with enough about the page and the launch to act on it, and counted for
the dashboard.

It is not a support desk: nothing is stored about a report beyond its counts,
and replies happen in Discord.

## Code map

| Path                                                          | Role                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/backend/features/feedback/contract.ts`                   | Topics, categories, sources and their labels; the request body; a leaf          |
| `src/backend/features/feedback/routes.ts`                     | `POST /api/feedback`                                                            |
| `src/backend/features/feedback/channels.ts`                   | Which webhook secret each topic posts to                                        |
| `src/backend/features/feedback/discord.ts`                    | `buildReportMessage`, `postToDiscord`                                           |
| `src/backend/features/feedback/reported-part.ts`              | `findReportedPart`: the part, its link and its configuration as the reader sees |
| `src/backend/features/feedback/rate-limit.ts`                 | `takeReportSlot`: reports per reporter per hour                                 |
| `src/backend/features/analytics/tracking.ts`                  | `trackReport`, which records each sent report                                   |
| `src/backend/features/analytics/report-queries.ts`            | The dashboard's report counts and most reported parts                           |
| `src/frontend/features/feedback/components/feedback-form.tsx` | The one form every report is sent from                                          |
| `src/frontend/features/feedback/open-feedback.tsx`            | `openFeedbackForm`, `openPartReport`, `openErrorReport`                         |
| `src/frontend/features/feedback/diagnostics.ts`               | `collectDiagnostics`, `toReportedError`                                         |
| `src/frontend/features/feedback/components/report-button.tsx` | **Send a report**, beside an error notice                                       |
| `src/frontend/lib/errors.ts`                                  | `handleAppError`, `showReportableErrorToast`: the **Report** button on toasts   |
| `src/frontend/features/dashboard/report-summary.tsx`          | The dashboard's **Reports** sections                                            |

## Storage

- **Discord**, not ours: each report is one message (or one forum thread) in
  the topic's channel.
- **KV** `feedback-sent:` — by reporter (`user:<id>` signed in, `ip:<address>`
  otherwise), the times of their reports in the last hour, for an hour.
- **D1** — one `events` row per sent report (`type` `report`, with
  `report_topic`, `report_category`, `report_source`, and the element columns
  for a part report) and its `daily_report_metrics` rollup; see
  [analytics.md](./analytics.md).

## Flows

### Topics and channels

| Topic           | Channel secret                       | Library |
| --------------- | ------------------------------------ | ------- |
| FRCDesignApp    | `DISCORD_APP_WEBHOOK_URL`            | —       |
| Version Manager | `DISCORD_APP_WEBHOOK_URL`            | —       |
| FRCDesignLib    | `DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL` | its own |
| MKCad           | `DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL` | its own |
| ConfigLib       | `DISCORD_CONFIG_LIB_WEBHOOK_URL`     | its own |

Each secret is a Discord webhook url, set per environment with
`wrangler secret put` and in `.env` locally. A topic whose secret is unset
refuses reports with a `handled` 503.

### Where a report starts

The source decides what the form offers and what the report carries
(`feedbackCategories`):

- **General** — **Send feedback** in settings. The reporter picks the topic.
  The app's topics offer bug, feature request, question and other; a library's
  offer part request, search or organization, bug, feature request and other,
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

1. The form sends `{ topic, category, source, message, contact?, part?,
diagnostics }`. Diagnostics are gathered as it sends: the page url, the build
   id, the Onshape launch (from `useOnshapeLaunch`, since in-app navigation drops
   it from the url), the level the app is viewed as, the window size, and the
   error.
2. `feedbackBody` checks that the category belongs to the topic and source,
   that only a part report names a part, and that only an error report may
   have no message. Diagnostics are clipped to length rather than refused.
3. The route resolves the reporter (a user id when signed in, none otherwise)
   and takes a slot from the rate limit.
4. A part report looks the part up in the topic's library (`findReportedPart`),
   runs the selection through `toSelection`, and builds the Onshape link from
   `onshapeOverrides` and the readable `Name: value` lines from the parameters
   the reporter could see.
5. `postToDiscord` posts the embed with `?wait=true`. A forum channel answers
   code 220001 to a post without a thread, and the post is sent again with
   `thread_name`.
6. Once posted, `trackReport` records it in the background, under the id the
   post quotes in its footer.
7. The form closes with "Report sent. Thank you!", or stays open with the
   error if anything failed.

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
- The only identity in a report is the Onshape user id and what the reporter
  chose to type as contact; no name or email is looked up.
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
- **Retry with a thread only when Discord asks.** Discord documents
  `thread_name` only for forum channels, so a text channel's webhook is never
  sent one.
- **Links on cad's domain.** A reporter's company domain means nothing to the
  person reading the report.

_Last reviewed: 2026-10-31_
