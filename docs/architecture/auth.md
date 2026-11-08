# Auth, access levels and environment

## Purpose

Who is calling, what they may do, and how the server reaches Onshape on their
behalf. Everyone signs in with their own Onshape account through OAuth; there
are no app accounts. Access beyond browsing comes from a library's Onshape admin
team, plus one owner set by configuration.

## Code map

| Path                                                        | Role                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/backend/features/auth/onshape-oauth.ts`                | The OAuth handshake: authorize url, code exchange, token shape                     |
| `src/backend/features/auth/login.ts`                        | A sign-in in flight, held in its own short cookie                                  |
| `src/backend/features/auth/session.ts`                      | The session cookie and its KV record                                               |
| `src/backend/features/auth/request-auth.ts`                 | `productionAuth`: resolves the caller, their Onshape client and level              |
| `src/backend/features/auth/access-level.ts`                 | `AccessLevel` and its ordering; shared with the client                             |
| `src/backend/features/auth/guards.ts`                       | Route middleware: sign-in, editor, admin, owner                                    |
| `src/backend/features/auth/background-sessions.ts`          | Sessions a load can borrow when its requester's fails                              |
| `src/backend/features/auth/company.ts`, `cookie-options.ts` | `getSessionCompanyId`, `getSignInCompanyId`; writing and clearing the auth cookies |
| `src/backend/features/auth/routes.ts`                       | `/auth/sign-in`, `/auth/callback`, `/auth/sign-out`, `/api/access-data`            |
| `src/backend/features/auth/sign-in-error.ts`                | Where the callback sends a sign-in that didn't finish, and its params; a leaf      |
| `src/frontend/routes/_pages/sign-in-error.tsx`              | `/sign-in-error`: **Sign in again**, and a report of what Onshape said             |
| `src/backend/features/hints/store.ts`                       | Which features' dots a user has seen, carried by `/api/access-data`                |
| `src/backend/features/hints/routes.ts`                      | `POST /api/seen-hints`, sent by `useMarkHintSeen` once a feature is opened         |
| `src/backend/features/admin-team/`                          | The owner sets a library's admin team; members are synced from Onshape             |
| `src/backend/features/entry/routes.ts`                      | `/init`, where Onshape launches the app                                            |
| `src/backend/features/entry/document-access.ts`             | `findAccessProblem`: whether the grant can edit the document, and why not          |
| `src/frontend/routes/_pages/document-access.tsx`            | `/document-access`: what to do about a grant that can't                            |
| `src/backend/lib/context.ts`                                | `AppBindings` (every binding and variable) and `bindAuth`                          |
| `src/frontend/features/auth/access-level.ts`                | `useAccessData`: the server's level and the level the app is viewed as             |
| `src/frontend/features/auth/components/require-access.tsx`  | `RequireAccessLevel`, `RequireSignIn`: render children only past the guard         |
| `wrangler.jsonc`                                            | Per-environment vars and bindings                                                  |

## Storage

- **Cookies** (`SameSite=None; Secure; Partitioned`, since the app runs in
  Onshape's iframe; partitioned so a browser blocking third-party cookies keeps
  them), written only by `setAuthCookie` and `clearAuthCookie` in
  `cookie-options.ts`:
  `__Host-frc-design-app-session` holds an opaque session id; `__Host-frc-design-app-login`
  holds a sign-in's OAuth state and return path for ten minutes and is read once.
- **KV** `session:` — the session's access and refresh tokens, expiry, and the
  user id once resolved, for 30 days.
- **KV** `background-session:` — the latest session id of the owner and each
  admin team member (admins and editors), by user id, plus one reserved id for
  the dev override's user.
  chose and its synced members (`isTeamAdmin` per member).
- **KV** `seen-hints:` — by user id, the features (`Hint`) whose blue dot and
  **New** badge the user no longer needs, recorded by `POST /api/seen-hints`
  once the feature has been opened: the version manager's page on showing, the
  insert location's card on closing, an insert menu's ⋯ menu offering **Set
  default configuration** on closing, and a part's menu (on its card or in the
  insert menu) offering **Report an issue** on closing. Fastening an insert to
  circular edges is recorded by the insert request itself, and `markHintSeen`
  shows it at once. Kept until deleted; losing it only shows a dot again.
- **localStorage** (`ui-state`): `accessLevel`, the level the app is viewed as;
  `seenHints`, the hints dismissed in this browser. `useHasSeenHint` reads them
  beside the server's list, so signed out a dot stays gone, and signed in a
  refetch that reads KV before the dismissal lands can't bring it back.

## Flows

### Launch and sign-in

1. Onshape opens `/init?documentId=…&instanceType=…&elementId=…&sessionCompanyId=…&companyId=…`.
   `companyId` is the company that owns the document (`cad` for a personal
   one), which Onshape adds to every launch (`getDocumentCompanyId`).
   `sessionCompanyId` is the company the caller's Onshape session is in, the
   extension's `{$sessionCompanyId}` (`getSessionCompanyId`): an enterprise's,
   and `cad` everywhere else, an educator plan's classroom included. Onshape
   sends it only when the action URL names it. A version or microversion goes
   to `/version-error`.
2. With no session, one whose grant is for another company than the session
   company, or one for another user than the launch's `userId`, `/init` sends
   the caller through sign-in and back, passing on `sessionCompanyId`, marked
   so it never loops.
3. `/auth/sign-in?sessionCompanyId=` stores `{ state, redirectUrl }` in the
   login cookie and redirects to Onshape's authorize page. It names the session
   company as `company_id` when it is an enterprise's (`getSignInCompanyId`),
   and none for `cad`, when Onshape asks the caller which account. OAuth takes
   an enterprise's id alone: a classroom's is refused as "Invalid company ID".
   The app's own **Sign in** passes the launch's `sessionCompanyId` the same
   way. The redirect url must be a local path.
4. The authorize request names `APP_URL/auth/callback` as its redirect uri,
   which must be registered on the OAuth app. Onshape returns there; the callback checks
   the state, exchanges the code, starts a session (a new id), and redirects back.
   When it can't, it never answers with a bare error, which would leave the
   panel's frame blank: `access_denied` goes to `/grant-denied`, a missing
   login cookie to `/cookie-error`, and any other `error` from Onshape, a
   missing code or a state it didn't hand out to `/sign-in-error`
   (`signInErrorUrl`). That page carries Onshape's `error` and
   `error_description` (or a `CallbackProblem`) and where the sign-in was
   going. Its **Sign in again** names no company, so Onshape lets the caller
   choose the account, and **Send a report** carries the error.
5. Back at `/init`, `findAccessProblem` reads the document as the caller's
   grant sees it (`getDocument`), whose `permissionSet` says what the grant may
   do and whose `owner` says who owns it. With `WRITE` the app opens. Without
   it, whether the grant can only view the document or can't see it at all (a
   403 or 404), the owner decides the notice: `owner.type` is a user or a
   company, and `isEnterpriseOwnedResource` tells an enterprise from a
   classroom, which are both companies. A document the grant can't see says
   nothing of its owner, so the launch does: a `companyId` of `cad` is
   personal, one matching `sessionCompanyId` an enterprise's, and any other a
   classroom's. `/init` then sends the launch to `/document-access` with the
   `problem` (`AccessProblem`): `classroom` for a classroom's document;
   `other-account` for a personal one under a company's grant (`sessioninfo`),
   which only the caller can have chosen; and `view-only` otherwise. A
   document that sends no `permissionSet` opens the app.
6. `/document-access` says the app can't edit the document, and what to do:
    - **`other-account` on a personal document**: "Sign in and choose your
      personal account". **Sign in** goes through sign-in naming no company and
      back to `/init`.
    - **`classroom`**: the grant for a classroom is the caller's to give on
      Onshape's side, so **Open Applications page** opens Onshape's
      Applications page (`/user/applications` on the launch's server).
    - **Anything else**: the caller can only view the document, a public one
      or one shared view-only.

    Each offers **Send a report**, its kind naming which. With no session, or
    Onshape not answering, the app opens as before: the check never keeps
    anybody out on a guess.

### Sign-out

Standalone only: inside Onshape the session is Onshape's to end. **Sign out**
sends the browser to `/auth/sign-out?redirectUrl=<current page>`, which deletes
the session's KV record and its cookie, then returns to the page, where access
is refetched signed out. The Onshape tokens themselves are not revoked; they
expire on their own.

### A request

`bindAuth` puts lazy answers on `c.var`, so a route that asks nothing never calls
Onshape:

- `getOnshapeApi` — an Onshape client from the session's tokens, refreshing
  when expired and on a 401; the refreshed tokens are saved before use.
- `getUserId` — resolved from Onshape once and kept on the session.
- `getAccessLevel(libraryId)` — see below.
- `isAuthenticated` — the session works, its company matches the launch's
  session company, **and** its user is the launch's `userId` when Onshape
  sends one.

### Access levels

| Level      | Who                                | May                                                                                                                                         |
| ---------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Owner**  | The user `OWNER_USER_ID` names     | Everything, in every library; set admin teams; **Reload all**                                                                               |
| **Admin**  | A team admin of the library's team | Editor rights, plus refreshing the team and **Hold new versions**                                                                           |
| **Editor** | A member of the library's team     | Groups (add, delete, order, sort), element settings and visibility, build status, **Reload**, approving held versions, **Reload thumbnail** |
| **User**   | Anyone signed in                   | Browse, insert, favorites, recents                                                                                                          |

`getAccessLevel` returns owner for `OWNER_USER_ID`, otherwise looks the caller
up in the library's stored `admin_team`. It is a database read, never an Onshape
call. The team is synced when the owner sets it, when Onshape's
`onshape.team.addmember` or `.removemember` arrives for it, and when an admin
presses **Refresh**. Onshape sends a team's events only to a webhook on the
company that owns it, an enterprise or an educator plan's classroom, so setting
a team checks its owner (`getTeam`) and refuses one a person owns, an old kind
Onshape no longer creates. The webhook is registered under the owner's session
with that company's id, and unregistered once no library has the team; a
delivery about another of the company's teams is ignored, and one about this
team syncs every library that has it, under a background session.

Routes gate with `requireSignInMiddleware`, `requireEditorMiddleware`,
`requireAdminMiddleware` and `requireOwnerMiddleware`. A library-gated route
names its library in the path (`libraryRoute()`), and the middleware checks the
caller's level there; a route acting on a group or element also scopes its
query to that library, so naming your own library with another's element finds
nothing. The owner's level is the same everywhere, so the owner check always
asks about the default library.

Whenever the owner's or an admin team member's level is checked, their session
id is saved under `background-session:` so background work can borrow it (see
[loading.md](./loading.md)).

On the client, `useAccessData` combines the server's level with the level the
user chose to view the app as, clamped to what the server grants.

## Environment variables

| Name                                     | Where it is set                                  | Read by                                        | Effect                                                                                                  |
| ---------------------------------------- | ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET` | Secrets per environment; `.env` locally          | `onshape-oauth.ts`                             | The Onshape OAuth app                                                                                   |
| `OWNER_USER_ID`                          | `wrangler.jsonc` vars                            | `request-auth.ts`, `background-sessions.ts`    | The owner; unset grants nobody                                                                          |
| `NODE_ENV`                               | `wrangler.jsonc` vars                            | `request-auth.ts`                              | Anything but `production` arms the two dev overrides below                                              |
| `VITE_ACCESS_LEVEL_OVERRIDE`             | `.env`                                           | Server and client                              | Server grants it (dev only); client views the app at it by default                                      |
| `FORCE_SIGNED_IN`                        | `.env`                                           | `request-auth.ts`                              | Dev only: signed in as a fake user with no Onshape session                                              |
| `APP_URL`                                | `wrangler.jsonc` vars; `.env` to override in dev | `onshape-oauth.ts`, webhooks, `vite.config.ts` | Where the app is served: the OAuth redirect uri, every webhook url, and the host the dev server accepts |
| `DISCORD_APP_WEBHOOK_URL`                | Secret per environment; `.env` locally           | `feedback/channels.ts`                         | Discord webhook for reports about the app and the version manager; unset refuses them                   |
| `DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL`     | Secret per environment; `.env` locally           | `feedback/channels.ts`                         | The same, for FRCDesignLib and MKCad                                                                    |
| `DISCORD_CONFIG_LIB_WEBHOOK_URL`         | Secret per environment; `.env` locally           | `feedback/channels.ts`                         | The same, for ConfigLib                                                                                 |

`README.md` also lists `API_ACCESS_KEY` and `API_SECRET_KEY`, which no code
reads.

Bindings (`DB`, `KV`, `BLOB`, `ASSETS`, the workflows, `CLIENT_RELAY`) are
declared in `wrangler.jsonc` per environment and typed in `AppBindings`. Run
`npx wrangler types` after changing them.

## Invariants

- The cookie holds only an opaque id; tokens never leave KV.
- Auth cookies are written only through `setAuthCookie` and `clearAuthCookie`:
  always partitioned, and at most one `Set-Cookie` per name per response.
- No unpartitioned cookie ever carries an auth cookie's name. The browser
  sends an older one first and `getCookie` reads the first, so one would hide
  the session: the caller signs in and still reads as signed out.
- A session is only created by a completed sign-in, with a fresh id.
- Access is decided on the server per library; the client's viewed level only
  hides UI and can never exceed the server's.
- Every elevated route checks the library the resource belongs to, not one the
  request claims.
- The dev overrides do nothing when `NODE_ENV` is `production`, and an override
  still requires a real session to pass a guard.
- The access level is a D1 read; no request calls Onshape to decide access.

## Failure and recovery

`/init` logs why a launch needs sign-in (`isAuthenticated`: no session, an
expired one, another company's or user's) with the names of the cookies that came;
the callback logs the cookie names, never values, when its login cookie is
missing.

| Failure                                                          | Result                                                                                                 | Recovery                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Access token expired                                             | Refreshed on the next call                                                                             | Automatic                                                  |
| Refresh token revoked or expired                                 | Treated as signed out                                                                                  | Sign in again                                              |
| The grant is another company's than the session company          | `/init` sends the caller through sign-in for the session company                                       | Automatic, once                                            |
| The session is another user's than the launch's                  | `/init` sends the caller through sign-in for the session company                                       | Automatic, once                                            |
| A classroom's document the grant can't edit                      | `/init` sends the launch to `/document-access` with `classroom`                                        | **Open Applications page**; **Send a report**              |
| A company's grant for a personal document                        | `/init` sends the launch to `/document-access`                                                         | **Sign in**, choosing the personal account                 |
| Document public or shared view-only                              | `/init` sends the launch to `/document-access`                                                         | Edit access from the document's owner                      |
| Team membership changed in Onshape                               | Synced when its webhook arrives                                                                        | **Refresh** beside the admin team, for a missed delivery   |
| No saved background session                                      | A load whose requester's session lapses fails                                                          | The owner or a team member opens the app                   |
| Onshape refuses the sign-in (`error` other than `access_denied`) | The callback logs it and sends the caller to `/sign-in-error` with Onshape's error                     | **Sign in again**, choosing the account; **Send a report** |
| The callback has no code, or a state it didn't hand out          | The callback sends the caller to `/sign-in-error`                                                      | **Sign in again**                                          |
| Browser refuses even a partitioned cookie (Brave, strict policy) | The callback finds no login cookie and sends the caller to `/cookie-error` (`/safari-error` in Safari) | Allow the app's cookies; **Send a report**                 |

## Decisions

- **Sign in as the session's enterprise.** OAuth's `company_id` takes an
  enterprise's id alone, and the session company is exactly that: Onshape
  fills it in for an enterprise and sends `cad` everywhere else. Asking for the
  document's company instead sent an educator plan classroom's id, which OAuth
  refused as "Invalid company ID", so no classroom launch could sign in.
- **Who owns the document, from the document.** A launch can't tell a
  classroom from an enterprise by its `companyId`, so the document's own
  `owner` says which notice to show. It comes in the same response as the
  permissions, so the check is one Onshape call per launch. The launch is the
  fallback for a document the grant can't see.
- **Match the launch's user, not only its company.** Every personal account
  shares the company `cad`, so a session left from another personal account,
  such as a team's shared one on the same browser, passes the company check
  and then can't see the owner's own document. Onshape names the launching
  user in `userId`, and the session's user comes back with its company from
  the same `sessioninfo` call, so comparing them costs nothing.
- **Onshape teams as the permission source.** Library admins already manage the
  documents in Onshape; the app mirrors that rather than keeping its own roles.
- **Synced, not live.** Asking Onshape on every request would spend the
  allocation and add latency; membership rarely changes, and Onshape says when
  it does.
- **Ask about the document, not only the company.** The grant's company can
  match the document's while it still can't edit it, which surfaced as
  a 403 on the first insert. One call per launch finds it before anything is
  tried.
- **Partitioned cookies.** Keyed to the top-level site, they survive a browser
  that blocks third-party cookies. The panel and the standalone app hold
  separate sessions, each signed in on its own; `/init` already signs the panel
  in, so nothing relies on sharing one.
- **`__Host-` names, not the names the cookies had unpartitioned.** A
  partitioned cookie is separate from an unpartitioned one of the same name,
  and Chrome sends the older first. Expiring the old one in the same response
  fails in Firefox, which partitions a frame's cookies regardless, so the
  expiry lands on the new cookie. New names leave the old cookies unread until
  they expire; `__Host-` also keeps a subdomain from setting them.
- **Login state in a cookie, not KV.** A caller who abandons sign-in keeps the
  session they had, and nothing needs cleaning up.

_Last reviewed: 2026-09-27_
