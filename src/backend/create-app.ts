import { HTTPException } from "hono/http-exception";
import { authRoutes, getSessionCompanyId, isAuthenticated } from "./auth";
import { getApp, type AppServicesFactory } from "./app";
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
    app.route("/auth", authRoutes);

    // `/init` is the auth-gated entry point
    app.on("GET", "/init", async (c) => {
        if (!(await isAuthenticated(c))) {
            const signInUrl = `/auth/sign-in?redirectUrl=${encodeURIComponent(c.req.url)}&sessionCompanyId=${getSessionCompanyId(c)}`;
            return c.redirect(signInUrl);
        }
        // Forward to normal Cloudflare
        return c.env.ASSETS.fetch(c.req.raw);
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
