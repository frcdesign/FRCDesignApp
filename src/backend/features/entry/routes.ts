/**
 * `/init` is where Onshape lands. It gates on auth, then resumes the caller in
 * the tab and theme they last used.
 */
import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "../../db/client";
import { groups, users } from "../../db/schema";
import { cacheMiddleware } from "../../lib/cache";
import { getApp, type AppContext } from "../../lib/context";
import { isSignedIn } from "../auth/request-auth";
import { getSessionCompanyId, PERSONAL_COMPANY_ID } from "../auth/session";
import { DEFAULT_SETTINGS } from "../settings/settings";
import { type AppTab, isLibraryTab, toAppTab } from "../settings/app-tab";
import { trackAppOpen, trackInBackground } from "../analytics/tracking";

/** Marks the `/init` a sign-in returns to; see {@link needsSignIn}. */
const SIGN_IN_ATTEMPTED = "signInAttempted";

/**
 * Whether to send the caller through Onshape's sign-in before opening the app.
 *
 * The gate is `isAuthenticated`: a session Onshape takes, scoped to the company
 * whose document the panel was opened in. What a sign-in cannot always do is
 * produce one. Onshape's authorize endpoint takes a `company_id` to scope a
 * token to an enterprise and documents no value standing for a personal
 * account, so for a caller holding an enterprise session who opens a plain
 * cad.onshape.com document there is nothing to ask for on their behalf — and
 * the reported redirect loop is what came of asking anyway.
 *
 * So a caller with no session at all is always worth signing in, and one whose
 * session is merely scoped elsewhere only when there is a company to name.
 * `SIGN_IN_ATTEMPTED` backstops both: whatever came back, the app opens on the
 * second pass rather than bouncing a third time.
 */
async function needsSignIn(c: AppContext): Promise<boolean> {
    if (await c.var.isAuthenticated()) return false;
    if (c.req.query(SIGN_IN_ATTEMPTED) !== undefined) return false;
    return (
        !(await isSignedIn(c)) || getSessionCompanyId(c) !== PERSONAL_COMPANY_ID
    );
}

/** Where the gate sends a caller Onshape will not take, and back to here. */
function getSignInUrl(c: AppContext): string {
    const url = new URL(c.req.url);
    url.searchParams.set(SIGN_IN_ATTEMPTED, "1");
    const query = new URLSearchParams({
        // Cloudflare strips the port in local dev, so come back relatively.
        redirectUrl: url.pathname + url.search,
        sessionCompanyId: getSessionCompanyId(c)
    });
    return `/auth/sign-in?${query.toString()}`;
}

interface AppEntry {
    url: string;
    /** Absent when nobody is signed in, so there is no one to look up. */
    userId?: string;
    tabId: AppTab;
}

/** Where the caller left off, as their row records it. */
function getUserEntry(db: Db, userId: string) {
    // The join is the check on the stored group: one deleted, left behind by a
    // library switch, or belonging to no library at all — which is every group
    // against a utility tab — comes back null and lands the caller in the tab.
    return db
        .select({
            tabId: users.tabId,
            theme: users.theme,
            libraryChosen: users.libraryChosen,
            groupId: groups.id
        })
        .from(users)
        .leftJoin(
            groups,
            and(eq(groups.id, users.groupId), eq(groups.libraryId, users.tabId))
        )
        .where(eq(users.id, userId))
        .get();
}

/**
 * The url the caller resumes at, seeded with what they last used. Returns who
 * they are too, so `/init` records the open without a second lookup.
 */
async function getAppEntry(c: AppContext): Promise<AppEntry> {
    const userId = (await isSignedIn(c)) ? await c.var.getUserId() : undefined;
    const user = userId
        ? await getUserEntry(getDb(c.env.DB), userId)
        : undefined;

    const search = new URL(c.req.url).searchParams;
    // Ours, and spent: the app is being opened, however that turned out.
    search.delete(SIGN_IN_ATTEMPTED);
    const systemTheme = search.get("theme");
    if (systemTheme !== null) {
        search.set("systemTheme", systemTheme);
    }
    search.set("theme", user?.theme ?? DEFAULT_SETTINGS.theme);
    // Seeded only when the account has answered the program prompt. The store
    // keeps its own answer — and is the one thing a caller nobody is signed in
    // as has — so a false here would ask a second time rather than say less.
    if (user?.libraryChosen) {
        search.set("libraryChosen", "true");
    }

    // Checked rather than trusted, as the stored group above is: the frontend
    // 404s an id it does not know, and this url is the only thing between a
    // stale row and the caller's panel.
    const tabId = toAppTab(user?.tabId, DEFAULT_SETTINGS.tabId);
    const path = `/app/tab/${tabId}`;
    const groupPath = user?.groupId ? `${path}/groups/${user.groupId}` : path;
    return { url: `${groupPath}?${search.toString()}`, userId, tabId };
}

export const entryRoutes = getApp();

/** GET /init */
entryRoutes.get("/init", cacheMiddleware(), async (c) => {
    if (await needsSignIn(c)) {
        return c.redirect(getSignInUrl(c));
    }
    const { url, userId, tabId } = await getAppEntry(c);
    // Reaching here is exactly "the panel was opened", and it is the only entry
    // Onshape uses. Best-effort, so the redirect never waits on it. Only a
    // library open is logged: the log is library-scoped, and a utility tab has
    // nothing to count under until it has an event of its own.
    if (userId && isLibraryTab(tabId)) {
        await trackInBackground(c, () =>
            trackAppOpen(c, { libraryId: tabId, userId })
        );
    }
    return c.redirect(url);
});
