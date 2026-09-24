/** Where Onshape lands: gates on auth, then resumes the last tab and theme. */
import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "../../db/client";
import { groups, users } from "../../db/schema";
import { cacheMiddleware } from "../../lib/cache";
import { getApp, type AppContext } from "../../lib/context";
import { isSignedIn } from "../auth/request-auth";
import { getSessionCompanyId, PERSONAL_COMPANY_ID } from "../auth/session";
import { DEFAULT_THEME } from "../settings/settings";
import { DEFAULT_LIBRARY } from "../library/library-id";
import {
    type AppTab,
    getTabPath,
    isLibraryTab,
    toAppTab
} from "../settings/app-tab";
import { trackAppOpen, trackInBackground } from "../analytics/tracking";

/** Marks the `/init` a sign-in returns to; see {@link needsSignIn}. */
const SIGN_IN_ATTEMPTED = "signInAttempted";

/**
 * Onshape's authorize endpoint has no `company_id` for a personal account, so
 * a caller with an enterprise session opening a personal document can't get a
 * session for it; asking anyway loops. So only sign in when there's no session
 * or a company to name, and `SIGN_IN_ATTEMPTED` stops a second bounce.
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
    /** Where the caller lands: the default until they have chosen. */
    tabId: AppTab;
}

/** Where the caller left off, as their row records it. */
function getUserEntry(db: Db, userId: string) {
    // A deleted or stale group joins to null, landing in the tab itself.
    return db
        .select({
            tabId: users.tabId,
            theme: users.theme,
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

/** Also returns the user id, so `/init` records the open without another lookup. */
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
    search.set("theme", user?.theme ?? DEFAULT_THEME);

    // Validated: the frontend 404s an unknown id.
    const chosenTab = user?.tabId
        ? toAppTab(user.tabId, DEFAULT_LIBRARY)
        : undefined;
    // Without a tab the welcome asks for one.
    if (chosenTab) {
        search.set("tabId", chosenTab);
    }
    const tabId = chosenTab ?? DEFAULT_LIBRARY;
    const path = getTabPath(tabId);
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
    // Only library opens are logged, since the log is per library.
    if (userId && isLibraryTab(tabId)) {
        await trackInBackground(c, () =>
            trackAppOpen(c, { libraryId: tabId, userId })
        );
    }
    return c.redirect(url);
});
