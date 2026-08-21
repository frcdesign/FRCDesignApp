/**
 * Composition root: binds the caller onto every request and mounts each
 * feature's routes. Everything it wires lives in a feature or in lib.
 */
import { accessRoutes, authRoutes } from "./features/auth/routes";
import { buildStatusRoutes } from "./features/build-checker/routes";
import { configurationRoutes } from "./features/configurations/routes";
import { entryRoutes } from "./features/entry/routes";
import { favoriteRoutes } from "./features/favorites/routes";
import { groupRoutes } from "./features/library/groups/routes";
import { insertableRoutes } from "./features/library/insertables/routes";
import { libraryRoutes } from "./features/library/routes";
import { settingsRoutes } from "./features/settings/routes";
import { thumbnailRoutes } from "./features/thumbnails/routes";
import { logger } from "hono/logger";
import { cacheMiddleware } from "./lib/cache";
import { bindCaller, getApp, type CallerFactory } from "./lib/context";
import { errorHandler } from "./lib/errors";

const apiRoutes = [
    accessRoutes,
    settingsRoutes,
    libraryRoutes,
    groupRoutes,
    insertableRoutes,
    configurationRoutes,
    thumbnailRoutes,
    favoriteRoutes,
    buildStatusRoutes
];

export function createApp(makeCaller: CallerFactory) {
    const app = getApp();

    // console.log reaches Workers Logs, since wrangler.jsonc enables
    // observability. Only /init, /api/* and /auth/* run the Worker at all
    // (see run_worker_first), so static assets are not logged.
    app.use("*", logger());

    app.use("*", bindCaller(makeCaller));

    for (const routes of apiRoutes) {
        app.route("/api", routes);
    }

    // Per-request redirects carrying OAuth state; never reusable.
    app.use("/auth/*", cacheMiddleware());
    app.route("/auth", authRoutes);

    app.route("/", entryRoutes);

    app.onError(errorHandler);

    return app;
}
