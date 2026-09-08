/**
 * `/init` is where Onshape lands. It gates on auth, then resumes the caller in
 * the library and theme they last used.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { group, users } from "../../db/schema";
import { cacheMiddleware } from "../../lib/cache";
import { getApp, type AppContext } from "../../lib/context";
import { getSessionCompanyId } from "../auth/session";
import { DEFAULT_SETTINGS } from "../settings/settings";
import { LibraryId } from "../library/library-id";
import { trackAppOpen, trackInBackground } from "../analytics/tracking";

/** Cloudflare strips the port in local dev, so redirect back relatively. */
function getRelativeUrl(requestUrl: string) {
    const { pathname, search } = new URL(requestUrl);
    return pathname + search;
}

interface AppEntry {
    url: string;
    userId: string;
    libraryId: LibraryId;
}

/**
 * The url the caller resumes at, seeded with what they last used. Returns who
 * they are too, so `/init` records the open without a second lookup.
 */
async function getAppEntry(c: AppContext): Promise<AppEntry> {
    const db = getDb(c.env.DB);
    const userId = await c.var.getUserId();
    // The join is the check on the stored group: one deleted, or left behind by
    // a library switch, comes back null and lands the caller in the library.
    const user = await db
        .select({
            libraryId: users.libraryId,
            theme: users.theme,
            groupId: group.id
        })
        .from(users)
        .leftJoin(
            group,
            and(
                eq(group.id, users.groupId),
                eq(group.libraryId, users.libraryId)
            )
        )
        .where(eq(users.id, userId))
        .get();

    const search = new URL(c.req.url).searchParams;
    const systemTheme = search.get("theme");
    if (systemTheme !== null) {
        search.set("systemTheme", systemTheme);
    }
    search.set("theme", user?.theme ?? DEFAULT_SETTINGS.theme);

    const libraryId = user?.libraryId ?? DEFAULT_SETTINGS.libraryId;
    const path = `/app/library/${libraryId}`;
    const groupPath = user?.groupId ? `${path}/groups/${user.groupId}` : path;
    return { url: `${groupPath}?${search.toString()}`, userId, libraryId };
}

export const entryRoutes = getApp();

/** GET /init */
entryRoutes.get("/init", cacheMiddleware(), async (c) => {
    if (!(await c.var.isAuthenticated())) {
        const redirectUrl = encodeURIComponent(getRelativeUrl(c.req.url));
        return c.redirect(
            `/auth/sign-in?redirectUrl=${redirectUrl}&sessionCompanyId=${getSessionCompanyId(c)}`
        );
    }
    const entry = await getAppEntry(c);
    // Reaching here is exactly "the panel was opened", and it is the only entry
    // Onshape uses. Best-effort, so the redirect never waits on it.
    await trackInBackground(c, () =>
        trackAppOpen(c, { libraryId: entry.libraryId, userId: entry.userId })
    );
    return c.redirect(entry.url);
});
