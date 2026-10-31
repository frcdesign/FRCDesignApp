# Auth, access levels and environment

## Purpose

Who is calling, what they may do, and how the server reaches Onshape on their
behalf. Everyone signs in with their own Onshape account through OAuth; there
are no app accounts. Access beyond browsing comes from a library's Onshape admin
team, plus one owner set by configuration.

## Code map

| Path                                                        | Role                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/backend/features/auth/onshape-oauth.ts`                | The OAuth handshake: authorize url, code exchange, token shape             |
| `src/backend/features/auth/login.ts`                        | A sign-in in flight, held in its own short cookie                          |
| `src/backend/features/auth/session.ts`                      | The session cookie and its KV record                                       |
| `src/backend/features/auth/request-auth.ts`                 | `productionAuth`: resolves the caller, their Onshape client and level      |
| `src/backend/features/auth/access-level.ts`                 | `AccessLevel` and its ordering; shared with the client                     |
| `src/backend/features/auth/guards.ts`                       | Route middleware: sign-in, editor, admin, owner                            |
| `src/backend/features/auth/background-sessions.ts`          | Sessions a load can borrow when its requester's fails                      |
| `src/backend/features/auth/company.ts`, `cookie-options.ts` | Enterprise company matching; cross-site cookie settings                    |
| `src/backend/features/auth/routes.ts`                       | `/auth/sign-in`, `/auth/callback`, `/auth/sign-out`, `/api/access-data`    |
| `src/backend/features/hints/store.ts`                       | Which features' dots a user has seen, carried by `/api/access-data`        |
| `src/backend/features/hints/routes.ts`                      | `POST /api/seen-hints`, sent by `useMarkHintSeen` once a feature is opened |
| `src/backend/features/admin-team/`                          | The owner sets a library's admin team; members are synced from Onshape     |
| `src/backend/features/entry/routes.ts`                      | `/init`, where Onshape launches the app                                    |
| `src/backend/features/entry/document-access.ts`             | `findDocumentAccessProblem`: whether the grant can edit the document       |
| `src/frontend/routes/_pages/document-access.tsx`            | `/document-access`: what to do about a grant that can't                    |
| `src/backend/lib/context.ts`                                | `AppBindings` (every binding and variable) and `bindAuth`                  |
| `src/frontend/features/auth/access-level.ts`                | `useAccessData`: the server's level and the level the app is viewed as     |
| `src/frontend/features/auth/components/require-access.tsx`  | `RequireAccessLevel`, `RequireSignIn`: render children only past the guard |
| `wrangler.jsonc`                                            | Per-environment vars and bindings                                          |

## Storage

- **Cookies** (`SameSite=None; Secure`, since the app runs in Onshape's iframe):
  `frc-design-app-session` holds an opaque session id; `frc-design-app-login`
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
  insert location's card on closing, and an insert menu's ⋯ menu offering **Set
  default configuration** on closing. Signed out, the dot goes for the session only.
  Kept until deleted; losing it only shows a dot again.
- **localStorage** (`ui-state`): `accessLevel`, the level the app is viewed as.

## Flows

### Launch and sign-in

1. Onshape opens `/init?documentId=…&instanceType=…&elementId=…&sessionCompanyId=…`.
   A version or microversion goes to `/version-error`.
2. With no session, or one for another company than the document's, `/init`
   sends the caller through sign-in and back, marked so it never loops.
3. `/auth/sign-in` stores `{ state, redirectUrl }` in the login cookie and
   redirects to Onshape's authorize page. The redirect url must be a local path.
4. The authorize request names `APP_URL/auth/callback` as its redirect uri,
   which must be registered on the OAuth app. Onshape returns there; the callback checks
   the state, exchanges the code, starts a session (a new id), and redirects back.
5. Back at `/init`, `findDocumentAccessProblem` asks Onshape for the caller's
   permissions on the document (`getPermissions`). With `WRITE` the app opens.
   Otherwise `/init` sends the launch to `/document-access?problem=…`:
   `wrong-account` when the grant can't see the document at all (no
   permissions, or a 404), `read-only` when it can see but not edit. A grant
   is per Onshape account, so one given to somebody's personal account can't
   reach their Enterprise's documents however the session's company reads, and
   sign-in can ask Onshape for an Enterprise but never for a personal account.
6. `/document-access` explains, for the document's account, how to revoke the
   grant on Onshape's Applications page and grant it again to the right
   account, and offers **Try again** (back through `/init`), **Continue
   anyway** (the app, which still browses) and **Send a report**. With no
   session, or Onshape not answering, the app opens as before: the check never
   keeps anybody out on a guess.

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
- `isAuthenticated` — the session works **and** its company matches the
  launching document's.

### Access levels

| Level      | Who                                | May                                                                                                                                         |
| ---------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Owner**  | The user `OWNER_USER_ID` names     | Everything, in every library; set admin teams; **Reload all**                                                                               |
| **Admin**  | A team admin of the library's team | Editor rights, plus refreshing the team and **Hold new versions**                                                                           |
| **Editor** | A member of the library's team     | Groups (add, delete, order, sort), element settings and visibility, build status, **Reload**, approving held versions, **Reload thumbnail** |
| **User**   | Anyone signed in                   | Browse, insert, favorites                                                                                                                   |

`getAccessLevel` returns owner for `OWNER_USER_ID`, otherwise looks the caller
up in the library's stored `admin_team`. It is a database read, never an Onshape
call; the team is synced when the owner sets it or an admin presses **Refresh**,
because Onshape's team webhooks need a company, which a personal account lacks.

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

| Name                                                                                  | Where it is set                                  | Read by                                        | Effect                                                                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`                                              | Secrets per environment; `.env` locally          | `onshape-oauth.ts`                             | The Onshape OAuth app                                                                                   |
| `OWNER_USER_ID`                                                                       | `wrangler.jsonc` vars                            | `request-auth.ts`, `background-sessions.ts`    | The owner; unset grants nobody                                                                          |
| `NODE_ENV`                                                                            | `wrangler.jsonc` vars                            | `request-auth.ts`                              | Anything but `production` arms the two dev overrides below                                              |
| `VITE_ACCESS_LEVEL_OVERRIDE`                                                          | `.env`                                           | Server and client                              | Server grants it (dev only); client views the app at it by default                                      |
| `FORCE_SIGNED_IN`                                                                     | `.env`                                           | `request-auth.ts`                              | Dev only: signed in as a fake user with no Onshape session                                              |
| `APP_URL`                                                                             | `wrangler.jsonc` vars; `.env` to override in dev | `onshape-oauth.ts`, webhooks, `vite.config.ts` | Where the app is served: the OAuth redirect uri, every webhook url, and the host the dev server accepts |
| `DISCORD_APP_WEBHOOK_URL`                                                             | Secret per environment; `.env` locally           | `feedback/channels.ts`                         | Discord webhook for reports about the app and the version manager; unset refuses them                   |
| `DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL`                                                  | Secret per environment; `.env` locally           | `feedback/channels.ts`                         | The same, for FRCDesignLib and MKCad                                                                    |
| `DISCORD_CONFIG_LIB_WEBHOOK_URL`                                                      | Secret per environment; `.env` locally           | `feedback/channels.ts`                         | The same, for ConfigLib                                                                                 |
| `DISCORD_APP_TAG_IDS`, `DISCORD_FRC_DESIGN_LIB_TAG_IDS`, `DISCORD_CONFIG_LIB_TAG_IDS` | Secret or var per environment; `.env` locally    | `feedback/channels.ts`                         | Each forum's tag ids as JSON by tag key; unset files reports untagged                                   |

`README.md` also lists `API_ACCESS_KEY` and `API_SECRET_KEY`, which no code
reads.

Bindings (`DB`, `KV`, `BLOB`, `ASSETS`, the workflows, `CLIENT_RELAY`) are
declared in `wrangler.jsonc` per environment and typed in `AppBindings`. Run
`npx wrangler types` after changing them.

## Invariants

- The cookie holds only an opaque id; tokens never leave KV.
- A session is only created by a completed sign-in, with a fresh id.
- Access is decided on the server per library; the client's viewed level only
  hides UI and can never exceed the server's.
- Every elevated route checks the library the resource belongs to, not one the
  request claims.
- The dev overrides do nothing when `NODE_ENV` is `production`, and an override
  still requires a real session to pass a guard.
- The access level is a D1 read; no request calls Onshape to decide access.

## Failure and recovery

| Failure                                   | Result                                         | Recovery                                 |
| ----------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Access token expired                      | Refreshed on the next call                     | Automatic                                |
| Refresh token revoked or expired          | Treated as signed out                          | Sign in again                            |
| Enterprise session opening a personal doc | `/init` sends the caller through sign-in       | Automatic, once                          |
| Grant for another account than the doc's  | `/init` sends the launch to `/document-access` | Revoke and grant again, per the page     |
| Document shared view-only                 | `/document-access`, read-only                  | Edit access from the owner, or a copy    |
| Team membership changed in Onshape        | Stale access until synced                      | **Refresh** beside the admin team        |
| No saved background session               | A load whose requester's session lapses fails  | The owner or a team member opens the app |

## Decisions

- **Onshape teams as the permission source.** Library admins already manage the
  documents in Onshape; the app mirrors that rather than keeping its own roles.
- **Synced, not live.** Asking Onshape on every request would spend the
  allocation and add latency; membership rarely changes.
- **Ask about the document, not only the company.** The session's company can
  match the document's while the grant still can't edit it, which surfaced as
  a 403 on the first insert. One permissions call per launch finds it before
  anything is tried.
- **Login state in a cookie, not KV.** A caller who abandons sign-in keeps the
  session they had, and nothing needs cleaning up.

_Last reviewed: 2026-09-27_
