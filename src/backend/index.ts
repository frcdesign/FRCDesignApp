export { LoadDocumentWorkflow } from "./parse/load-document";
import { authRoutes, isAuthenticated } from "./auth";
import { userRoutes } from "./routes/user";
import { libraryRoutes } from "./routes/library";
import { favoriteRoutes } from "./routes/favorites";
import { thumbnailRoutes } from "./routes/thumbnails";
import { documentRoutes } from "./routes/documents";
import { configurationRoutes } from "./routes/configurations";
import { Hono } from "hono";
import { AppBindings } from "./app";

const app = new Hono<{ Bindings: AppBindings }>();

// Mount all API routes
app.route("/api", userRoutes);
app.route("/api", libraryRoutes);
app.route("/api", favoriteRoutes);
app.route("/api", thumbnailRoutes);
app.route("/api", documentRoutes);
app.route("/api", configurationRoutes);
// Admin prefix bypasses Cloudflare CDN cache for editor/admin users
app.route("/api/admin", libraryRoutes);
app.route("/api/admin", configurationRoutes);
app.route("/auth", authRoutes);

app.get("/app", async (c) => {
    if (!(await isAuthenticated(c))) {
        return c.redirect(
            `/auth/sign-in?redirectUrl=${encodeURIComponent(c.req.url)}`
        );
    }
    return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
