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

/** Cloudflare strips the port in local dev, so redirect back relatively. */
function getRelativeUrl(requestUrl: string) {
    const { pathname, search } = new URL(requestUrl);
    return pathname + search;
}

/** Builds the url the caller resumes at, seeded with the library and theme they last used. */
async function getEntryUrl(c: AppContext): Promise<string> {
    const db = getDb(c.env.DB);
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
        .where(eq(users.id, await c.var.getUserId()))
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
    return `${groupPath}?${search.toString()}`;
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
    return c.redirect(await getEntryUrl(c));
});
