# Platform

## Purpose

The plumbing every feature shares: how the server calls Onshape, how failures
travel from Onshape to the user, every retry and timeout in one place, the
concurrency limits, toasts, pushes, and HTTP caching. Feature documents name
their Onshape calls and link here for how those calls behave.

## Code map

| Path                                              | Role                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/backend/lib/onshape/client.ts`               | `OnshapeApi`, `OAuthApi`, `ApiKeyApi`; `OnshapeApiError`, `OnshapeRateLimitError` |
| `src/backend/lib/onshape/endpoints/`              | One wrapper per Onshape endpoint, grouped by Onshape's API category               |
| `src/backend/lib/api-error.ts`                    | `ApiError` and its four kinds; the body every failed `/api` response carries      |
| `src/backend/lib/errors.ts`                       | `errorHandler`: turns any thrown error into that body and a status                |
| `src/backend/features/load/steps.ts`              | Workflow retry policies for Onshape and thumbnail steps                           |
| `src/backend/features/load/context.ts`            | The load's limiters                                                               |
| `src/backend/lib/cache.ts`                        | `CachePolicy`, `cacheMiddleware`, `setCache`                                      |
| `src/backend/features/push/`                      | `PushHub` Durable Object, message contract, `notify.ts` senders                   |
| `src/frontend/lib/api-client.ts`                  | `apiGet`, `apiPost`, `apiDelete`, `loadImage`; appends `?v=` for cached reads     |
| `src/frontend/lib/errors.ts`                      | `AppError`, `handleAppError`, `getAppErrorHandler`                                |
| `src/frontend/lib/notifications.tsx`              | `showLoadingToast`, `showSuccessToast`, `showInfoToast`, `showErrorToast`         |
| `src/frontend/lib/query-client.ts`                | TanStack Query defaults, including retry                                          |
| `src/frontend/lib/push-socket.ts`, `push-sync.ts` | The client's WebSocket, and applying pushes to the cache                          |

## Calling Onshape

Every call goes through `OnshapeApi._call` to
`https://cad.onshape.com/api/v17{path}`:

- **Auth.** `OAuthApi` sends `Authorization: Bearer <access token>`. On a 401 it
  calls its refresh callback once, which exchanges the refresh token, saves the
  new tokens to the session before returning, and repeats the request once. A
  second 401 is thrown. `ApiKeyApi` signs with an HMAC for scripts.
- **Timeout.** Each request aborts after 60 s (`REQUEST_TIMEOUT_MS`), well under
  a workflow step's 10-minute limit, so a hung call fails the step and it
  retries.
- **Query.** Built by `toQueryString` (`src/backend/lib/query-params.ts`),
  which spells a space `%20`: Onshape reads a `+` literally, and a
  configuration sent with one (`0.1524+m`) is ignored without an error.
- **Headers.** JSON in and out; images are fetched with `Accept: */*`, since
  under `image/*` a thumbnail still rendering answers 406 rather than 404.
- **Errors.** Any non-2xx throws `OnshapeApiError` with the status and the
  response text. A 429 throws `OnshapeRateLimitError` carrying `Retry-After`
  (60 s when absent), and spells it into the message, since a Workflow rebuilds
  errors and only the message survives; `readRetryAfterSeconds` reads it back.
- **No retry in the client.** A request is tried once (plus the 401 refresh). Retrying
  belongs to the caller: a workflow step's policy, or the user.

Which calls each flow makes is listed in that flow's document.

## Errors, end to end

A route throws; `errorHandler` answers with `{ kind, message }` and a status:

| Thrown                           | Kind               | Status   | Message the user sees                                       |
| -------------------------------- | ------------------ | -------- | ----------------------------------------------------------- |
| `handledError(message, status)`  | `handled`          | as given | `message`                                                   |
| `signInRequiredError(message)`   | `sign-in-required` | 401      | `message`, with a **Sign in** button                        |
| `forbiddenError(message)`        | `forbidden`        | 403      | `message`                                                   |
| `internalError(message, status)` | `internal`         | as given | The caller's default wording; `message` is logged           |
| `OnshapeRateLimitError`          | `handled`          | 429      | "Onshape rate limit reached. Please try again later."       |
| `OnshapeApiError` 401            | `sign-in-required` | 401      | "Onshape did not accept the session. Try signing in again." |
| `OnshapeApiError` 403            | `forbidden`        | 403      | "Onshape rejected the operation. …"                         |
| Any other `OnshapeApiError`      | `internal`         | 502      | Default wording; logged                                     |
| A validator's `HTTPException`    | `internal`         | its own  | Default wording; logged                                     |
| Anything else                    | `internal`         | 500      | Default wording; logged                                     |

On the client, `apiGet`/`apiPost` throw an `AppError` holding that body. A
mutation's `onError` is `getAppErrorHandler(defaultMessage, toastId)`, which
shows the body's message for `handled` and `forbidden`, adds a **Sign in**
action for `sign-in-required`, and shows `defaultMessage` for `internal` or any
non-`AppError`. Images use `loadImage`, which throws `ImageLoadError` with only
the status.

## Retries and timeouts

| Where                           | Setting                            | Policy                                                                                     |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Any Onshape request             | `REQUEST_TIMEOUT_MS`               | Aborts after 60 s                                                                          |
| Load steps calling Onshape      | `ONSHAPE_STEP_RETRIES`             | 5 retries after 10, 20, 40, 80, 160 s; a 429 waits its `Retry-After` plus 0–20 s of jitter |
| Load thumbnail steps            | `THUMBNAIL_RETRIES`                | 6 retries after 30 s, 1, 2, 4, 4, 4 min; a 429 as above                                    |
| Configuration renders           | `RENDER_RETRIES`                   | 12 retries every 5 s; a 429 waits its `Retry-After` plus jitter                            |
| A held load                     | `APPROVAL_TIMEOUT`                 | Waits 2 days for approval, then loads                                                      |
| A claimed job with no instance  | `CLAIM_GRACE_MS`                   | Treated as failed after 60 s                                                               |
| Client queries                  | `queryClient` default              | 2 retries, none for an `AppError` that isn't `internal`                                    |
| Stored thumbnails on the client | `STORED_RETRIES`                   | 1 retry                                                                                    |
| Waiting on a render             | `RENDER_TIMEOUT_MS`                | Gives up after 60 s without the image                                                      |
| Push socket                     | `FIRST_RETRY_MS` → `LAST_RETRY_MS` | Reconnects after 1 s, doubling to 30 s                                                     |

Workflows multiply a retry's delay by its backoff curve, so every policy returns
its own delay from a function and sets `backoff: "constant"`.

## Concurrency

| Limit                   | Value         | Bounds                                                           |
| ----------------------- | ------------- | ---------------------------------------------------------------- |
| `LOAD_CONCURRENCY`      | 15            | A load's insertables probed at once                              |
| `THUMBNAIL_CONCURRENCY` | 10            | A load's thumbnail steps at once; a slot is held through retries |
| `BATCH_SIZE` (records)  | 20            | Configurations probed per workflow step                          |
| Loads                   | one per group | `load_jobs`; a new request replaces the running one              |
| Renders                 | one per key   | The instance id is derived from the render's key                 |

## Toasts

Mantine notifications, bottom-centre, at most 3 on screen, closing after 4 s
unless told otherwise (`__root.tsx`). `showToast` keeps the ids of the toasts
it has open, and a second call with a live id **updates** that toast in place,
which is how a loading toast turns into its result.

| Kind    | Colour        | Closes                 | Used for                                            |
| ------- | ------------- | ---------------------- | --------------------------------------------------- |
| Loading | blue, spinner | Never, no close button | Work the user is waiting on; always given an id     |
| Success | green         | 4 s                    | The same id, when the work lands                    |
| Info    | blue          | 4 s, or as given       | Background work started; tips                       |
| Error   | red           | 4 s                    | Through `handleAppError`, on the loading toast's id |

The flows that use them:

| Action                        | Toast id                                                  | While                               | Then                                                            |
| ----------------------------- | --------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| Insert                        | per insertable                                            | "Inserting {name}..."               | "Successfully inserted {name}." (and "…created a Fasten mate.") |
| Add document                  | `add-group`                                               | "Adding document..."                | "Added {name}."                                                 |
| Reload thumbnail              | `reload-thumbnail`                                        | "Reloading thumbnail..."            | "Thumbnail reloaded."                                           |
| Show or hide elements         | `set-visibility`                                          | "Showing/Hiding insertables..."     | "Insertables shown/hidden."                                     |
| Toggle insert and fasten      | per insertable                                            | loading                             | success                                                         |
| Enable or disable indexing    | per insertable                                            | info: "Enabling/Disabling indexing" | "Indexing enabled/disabled."                                    |
| Exclude parameters            | per insertable                                            | info: "Reindexing part"             | "Part reindexed."                                               |
| Set or refresh the admin team | none                                                      | —                                   | "Admin team set/refreshed: {n} members."                        |
| Reload documents / approve    | none                                                      | —                                   | info: "Reloading {n} documents..."                              |
| Save favorite configuration   | none                                                      | —                                   | "Favorite default configuration set."                           |
| Tips                          | `quick-insert-tip`, `thumbnail-wait-tip`, sign-in preview | —                                   | info, 8 s                                                       |

Loading toasts are for work the user watches; background work gets an info
toast and then shows its progress where it happens (a group's spinner, a job
status). A mutation that fails shows its error on the same id, replacing the
loading toast.

## Pushes

One `PushHub` Durable Object holds every client's WebSocket
(`GET /api/push?library=<id>`), hibernating so idle sockets cost nothing, and
tags each with the library it shows.

| Message       | Sent by                                              | To                       | The client                                                     |
| ------------- | ---------------------------------------------------- | ------------------------ | -------------------------------------------------------------- |
| `jobs`        | `requestLoads`, `finishLoad`, approval changes       | That library's sockets   | Sets the job status query (editors only)                       |
| `library`     | A load that wrote, a shell group, an admin team sync | That library's sockets   | `refreshLibrary()`, which moves to the new cache version       |
| `thumbnail`   | Each stored render size                              | Every socket             | Refetches rows that missed that render; wakes a waiting render |
| `version-job` | A push or pull starting, and the workflow ending it  | That workspace's sockets | Sets the run's status query                                    |

A socket is tagged with the library it shows and, where Onshape launched the app
in one, the workspace it was launched in — which is what a `version-job` reaches.

A push says only what changed; the client refetches under its own access, so
nothing private travels over it. A failed send is logged, not thrown. A client
that reconnects refreshes the library, since pushes during the outage are lost.

## Caching

- **Versioned reads** (`library-data`, `search-db`, `build-status`,
  `configuration`, health) carry `?v=`, and `cacheMiddleware(PUBLIC_CACHE)`
  answers `public, max-age=31536000, immutable`, refusing a request without `v`.
  Only a success is cached; an error answers `private, no-store`.
- **Stored thumbnails** are immutable by their url (`v` is the microversion); a
  miss is `no-store`.
- **Everything else** is `private, no-store`.
- On the client, `useRefreshLibrary` invalidates the library's unversioned
  queries and the version itself; a versioned query's old url is left alone,
  since refetching it would restore the old state.

## Invariants

- The Onshape client never retries on its own; the caller's policy decides.
- Every retry policy honours a 429's `Retry-After`.
- A failed `/api` response always carries `{ kind, message }`, and only
  `handled`, `forbidden` and `sign-in-required` messages reach the user verbatim.
- A cached `/api` url always includes its version.
- A push carries no data a viewer isn't already allowed to fetch.

## Decisions

- **Retries at the step, not the request.** A workflow step's retry is durable
  and visible; a retry inside `fetch` would hide attempts inside one step's
  timeout.
- **One push hub.** Pushes are few and small; one instance keeps fan-out simple.
- **Errors by kind, not status.** The client decides wording from `kind`, so a
  status can change without changing what the user reads.

_Last reviewed: 2026-09-28_
