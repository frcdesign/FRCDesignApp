import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "../shared/schema";
import { DEFAULT_LIBRARY_ID, DEFAULT_SETTINGS } from "../shared/types";
import { authRoutes, getSessionCompanyId } from "./auth";
import {
    cacheMiddleware,
    getApp,
    type AppContext,
    type AppServicesFactory
} from "./app";
import { OnshapeRateLimitError } from "./onshape-api/onshape-api";
import { userRoutes } from "./routes/user";
import { libraryRoutes } from "./routes/library";
import { favoriteRoutes } from "./routes/favorites";
import { thumbnailRoutes } from "./routes/thumbnails";
import { insertableRoutes } from "./routes/insertables";
import { groupRoutes } from "./routes/groups";
import { configurationRoutes } from "./routes/configurations";
import { buildStatusRoutes } from "./routes/build-status";

/**
 * Returns the relative URL of the given requestUrl.
 * Used as a workaround to get the current URL without breaking in local dev due to Cloudflare stripping the port number.
 */
function getRelativeUrl(requestUrl: string) {
    const { pathname, search } = new URL(requestUrl);
    return pathname + search;
}

/** Builds the url the caller resumes at, seeded with the library and theme they last used. */
async function getEntryUrl(c: AppContext): Promise<string> {
    const db = getDb(c.env.DB);
    const user = await db
        .select({ libraryId: users.libraryId, theme: users.theme })
        .from(users)
        .where(eq(users.id, await c.var.getUserId()))
        .get();

    const search = new URL(c.req.url).searchParams;
    const systemTheme = search.get("theme");
    if (systemTheme !== null) {
        search.set("systemTheme", systemTheme);
    }
    const currentTheme = user?.theme ?? DEFAULT_SETTINGS.theme;
    search.set("theme", currentTheme);

    const libraryId = user?.libraryId ?? DEFAULT_LIBRARY_ID;
    return `/app/library/${libraryId}?${search.toString()}`;
}

/**
 * Composition root for the Hono app. The injected `makeServices` factory is
 * bound onto each request's context so handlers can call `c.var.getOnshapeApi()`,
 * `c.var.getUserId()`, and `c.var.getAccessLevel()` directly.
 */
export function createApp(makeServices: AppServicesFactory) {
    const app = getApp();

    app.use("*", async (c, next) => {
        const services = makeServices(c);
        c.set("getOnshapeApi", services.getOnshapeApi);
        c.set("getUserId", services.getUserId);
        c.set("getAccessLevel", services.getAccessLevel);
        c.set("isAuthenticated", services.isAuthenticated);
        await next();
    });

    // Mount all API routes
    app.route("/api", userRoutes);
    app.route("/api", libraryRoutes);
    app.route("/api", favoriteRoutes);
    app.route("/api", thumbnailRoutes);
    app.route("/api", groupRoutes);
    app.route("/api", insertableRoutes);
    app.route("/api", configurationRoutes);
    app.route("/api", buildStatusRoutes);
    // Per-request redirects carrying OAuth state; never reusable.
    app.use("/auth/*", cacheMiddleware());
    app.route("/auth", authRoutes);

    // `/init` is the auth-gated entry point.
    app.on("GET", "/init", cacheMiddleware(), async (c) => {
        if (!(await c.var.isAuthenticated())) {
            const currentUrl = getRelativeUrl(c.req.url);
            const signInUrl = `/auth/sign-in?redirectUrl=${encodeURIComponent(currentUrl)}&sessionCompanyId=${getSessionCompanyId(c)}`;
            return c.redirect(signInUrl);
        }
        return c.redirect(await getEntryUrl(c));
    });

    app.onError((err, c) => {
        // Surface an Onshape rate limit as a 429 the client can retry, rather
        // than blocking the request thread waiting it out.
        if (err instanceof OnshapeRateLimitError) {
            return c.json(
                {
                    error: "Onshape rate limit reached. Please try again shortly.",
                    retryAfterSeconds: err.retryAfterSeconds
                },
                429
            );
        }
        if (err instanceof HTTPException) {
            return err.getResponse();
        }
        console.error(err);
        return c.json({ error: "Internal Server Error" }, 500);
    });

    return app;
}
