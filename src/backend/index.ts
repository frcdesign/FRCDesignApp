export { LoadDocumentWorkflow } from "./parse/load-document";
import { authRoutes, isAuthenticated } from "./auth";
import { userRoutes } from "./routes/user";
import { libraryRoutes } from "./routes/library";
import { favoriteRoutes } from "./routes/favorites";
import { thumbnailRoutes } from "./routes/thumbnails";
import { insertableRoutes } from "./routes/insertables";
import { groupRoutes } from "./routes/groups";
import { configurationRoutes } from "./routes/configurations";
import { getApp } from "./app";

const app = getApp();

// Mount all API routes
app.route("/api", userRoutes);
app.route("/api", libraryRoutes);
app.route("/api", favoriteRoutes);
app.route("/api", thumbnailRoutes);
app.route("/api", groupRoutes);
app.route("/api", insertableRoutes);
app.route("/api", configurationRoutes);
app.route("/auth", authRoutes);

// `/init` is the auth-gated entry point; the SPA forwards from there to the
// document list. `/app` stays gated too so its routes can't be hit unauthed.
app.on("GET", "/init", async (c) => {
    if (!(await isAuthenticated(c))) {
        return c.redirect(
            `/auth/sign-in?redirectUrl=${encodeURIComponent(c.req.url)}`
        );
    }
    return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
