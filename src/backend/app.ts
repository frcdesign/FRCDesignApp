import { analyticsRoutes } from "./features/analytics/routes";
import { accessRoutes, authRoutes } from "./features/auth/routes";
import { buildStatusRoutes } from "./features/build-checker/routes";
import { configurationRoutes } from "./features/configurations/routes";
import { appOpenRoutes, entryRoutes } from "./features/entry/routes";
import { favoriteRoutes } from "./features/favorites/routes";
import { groupRoutes } from "./features/library/groups/routes";
import { insertLocationRoutes } from "./features/insert-location/routes";
import { insertableRoutes } from "./features/library/insertables/routes";
import { libraryRoutes } from "./features/library/routes";
import { thumbnailRoutes } from "./features/thumbnails/routes";
import { webhookRoutes } from "./features/webhooks/routes";
import { pushRoutes } from "./features/push/routes";
import { adminTeamRoutes } from "./features/admin-team/routes";
import { loadRoutes } from "./features/load/routes";
import { logger } from "hono/logger";
import { cacheMiddleware } from "./lib/cache";
import { bindAuth, getApp, type AuthResolver } from "./lib/context";
import { errorHandler } from "./lib/errors";

const apiRoutes = [
    accessRoutes,
    appOpenRoutes,
    libraryRoutes,
    groupRoutes,
    insertableRoutes,
    insertLocationRoutes,
    configurationRoutes,
    thumbnailRoutes,
    favoriteRoutes,
    buildStatusRoutes,
    analyticsRoutes,
    webhookRoutes,
    pushRoutes,
    adminTeamRoutes,
    loadRoutes
];

export function createApp(resolveAuth: AuthResolver) {
    const app = getApp();

    // To Workers Logs. Static assets don't run the Worker, so they aren't logged.
    app.use("*", logger());

    app.use("*", bindAuth(resolveAuth));

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
