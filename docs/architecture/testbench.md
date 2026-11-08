# Testbench

## Purpose

The owner's page for finding out how Onshape behaves before building on it:
which webhook events fire, whether the custom toolbar can be changed through
its internal endpoints, and where Onshape starts rate-limiting the calls the
app makes most. It is at `/testbench`, beside `/dashboard` outside the panel's
shell, opened from **Admin settings → Testbench**. It's a tool, not a feature
anyone uses, so it records no analytics.

Everything it learns goes in [ONSHAPE.md](../ONSHAPE.md); the testbench itself
keeps no findings past a day.

## Code map

`src/backend/features/testbench/routes.ts` and
`src/backend/features/testbench/webhook-probe.ts`

```text
POST   /api/testbench/onshape                one Onshape call as the owner, answered whatever its status
GET    /api/testbench/webhooks               every probe, newest first, with its deliveries
POST   /api/testbench/webhooks               registers a probe's webhook
DELETE /api/testbench/webhooks/:probeId      unregisters it and forgets it
POST   /api/testbench/webhooks/deliveries    Onshape's deliveries, matched by ?probe=&token=
```

`src/backend/lib/onshape/client.ts`

```ts
// Onshape's response whatever its status, for probing Onshape rather than using it.
OnshapeApi.send(method: string, path: string, options?: SendOptions): Promise<Response>;
function onshapeUrl(path: string, options?: Pick<SendOptions, "version" | "query">): string;

interface SendOptions extends QueryOptions {
    /** The API version to call; the app's own by default. */
    version?: number;
    body?: unknown;
}
```

`src/backend/features/testbench/contract.ts`

```ts
const onshapeCallBody: ZodObject; // method, version, path, query, body, includeBody

interface OnshapeCallResult {
    url: string;
    status: number;
    /** From just before the Worker sends it to Onshape's last byte. */
    durationMs: number;
    /** Every header Onshape answered with, names lowercased. */
    headers: Record<string, string>;
    /** Parsed when it is JSON, otherwise text; cut at MAX_BODY_CHARS. */
    body?: unknown;
    truncated?: boolean;
}
```

`src/frontend/features/testbench/burst.ts` and
`src/frontend/features/testbench/presets.ts`

```ts
function runBurst(
    send: BurstSend,
    options: BurstOptions,
    onSample: (sample: BurstSample) => void,
    signal: AbortSignal
): Promise<void>;
function summarizeBurst(samples: BurstSample[]): BurstSummary;
// Names Onshape might put a limit, a count left or a reset time under.
function isLimitHeader(name: string): boolean;
function presetCall(
    id: PresetId,
    element: ElementPath | undefined,
    script: string
): OnshapeCallBody | undefined;

interface BurstOptions {
    total: number;
    concurrency: number;
    /** Stop the burst at the first 429 and start watching for the reset. */
    stopOnLimit: boolean;
    /** Seconds between calls while watching for the reset. */
    pollSeconds: number;
    /** Give up watching after this long. */
    maxWaitSeconds: number;
}

enum PresetId {
    EVALUATE_FEATURESCRIPT = "evaluate-featurescript",
    PART_STUDIO_FEATURES = "part-studio-features",
    ASSEMBLY_DEFINITION = "assembly-definition",
    ASSEMBLY_FEATURES = "assembly-features",
    DOCUMENT_ELEMENTS = "document-elements",
    SESSION_INFO = "session-info"
}
```

`src/frontend/features/testbench/toolbar.ts` holds the toolbar endpoints'
calls and the shapes observed of them; the tabs are in
`src/frontend/features/testbench/components/`, under
`src/frontend/routes/testbench.tsx`.

## Storage

- **KV** `webhook-probe` (one key, every probe) and
  `webhook-probe-deliveries` (per probe, its last 50 deliveries): a day.
- Nothing else. A burst's samples live in the page until it's closed; **Copy
  results as JSON** is the way to keep them.

## Flows

### A call — `POST /api/testbench/onshape`

1. The owner guard, then the body is validated: a path of non-empty segments
   with no `..`, a version from 1 to 99.
2. `OnshapeApi.send` calls `https://cad.onshape.com/api/v{version}{path}` with
   the owner's token, refreshing it on a 401 as every call does.
3. Answers 200 with Onshape's status, headers, timing and, unless
   `includeBody` is off, its body. A 429 is an answer here, not an error.

### A burst — the Rate limits tab

1. Picks a call: a preset against the element a pasted url names, or the Raw
   request tab's call. Presets are the uncached calls Auto Assembly and insert
   make per hole or per part.
2. `runBurst` makes `total` calls, `concurrency` at a time, each its own
   `POST /api/testbench/onshape` from the page, without bodies.
3. With **Stop at the first 429**, the first 429 ends the burst; then one call
   every `pollSeconds` until one isn't a 429 or `maxWaitSeconds` pass. The time
   from the first 429 to that call is how long the limit lasted, to within
   `pollSeconds`.
4. A call the app refused (no answer from Onshape) ends the burst at once.
5. `summarizeBurst` reports counts, the rate reached before the first 429, how
   many calls succeeded before it, latencies, when the limit lifted, and every
   header whose name looks like a limit's, with the values it took.

### The custom toolbar tab

1. Reads the owner's user id (`/users/sessioninfo`) and lists
   `GET /toolbar/tools` at the chosen version, showing the owner's own tools
   (`ownerType` 0).
2. **Create** posts the edited body to `/toolbar/tools/u/{userId}/create`;
   **Copy to create** fills it from a listed tool. **Remove** sends
   `DELETE /toolbar/tools/u/{userId}/delete` with `{ remove: [id] }`.
3. Each answer is shown whole, so a refusal says what Onshape wanted.

### The webhooks tab

1. Registers a transient webhook with the events and params chosen, pointed at
   the delivery route with a fresh token. The probe is stored before Onshape is
   asked, since Onshape pings the url before it answers.
2. Each delivery is kept, newest first. The tab polls every three seconds while
   shown. **Delete** unregisters the webhook and forgets the probe.

## User-facing strings

[strings/testbench.md](../strings/testbench.md).

## Invariants

- Every testbench route but the delivery route is the owner's alone; the
  delivery route takes only a probe's own token.
- A call goes to `cad.onshape.com` under `/api/`, with the owner's token, and
  nowhere else.
- The Worker makes one Onshape call per request; bursts are driven by the
  page, so no request runs long or fans out.
- Nothing the testbench does is retried: each retry would be another call
  against the account's allocation and would blur what a burst measures.

## Failure and recovery

| What goes wrong                   | What happens                              | What puts it right                    |
| --------------------------------- | ----------------------------------------- | ------------------------------------- |
| The owner's session has lapsed    | Calls answer 401; a burst stops at once   | Sign in again                         |
| A burst leaves Onshape limiting   | The owner's own Onshape use may be slowed | Wait out the limit the burst measured |
| Onshape refuses a probe's webhook | The probe shows Onshape's refusal         | Change the params; delete the probe   |
| The page is closed mid-burst      | The burst stops; its samples are lost     | Copy results before closing           |

## Decisions

- **The page drives bursts, not the Worker.** A Worker request has a
  subrequest limit and a burst of hundreds would run for minutes; one call per
  request avoids both, shows progress live, and stops when the page does. The
  round trip from the page adds latency, so `durationMs` is Onshape's own time,
  measured in the Worker.
- **A raw call answers 200 whatever Onshape said.** The point is to see
  Onshape's statuses and headers, which the app's own client turns into
  errors.
- **Calls are made with the owner's OAuth token.** That is what the app's
  features use, so the limits measured are the ones they meet; whether a limit
  is per user, per app or per account is something a burst from a second user
  would show.

_Last reviewed: 2026-11-08_
