import { authRoutes, isAuthenticated } from "./auth";
import { userRoutes } from "./api/user";
import { libraryRoutes } from "./api/library";
import { thumbnailRoutes } from "./api/thumbnails";
import { documentRoutes } from "./api/documents";
import { configurationRoutes } from "./api/configurations";
import { Hono } from "hono";
import { AppBindings } from "./app";

const app = new Hono<{ Bindings: AppBindings }>();

// Mount all API routes
app.route("/api", userRoutes);
app.route("/api", libraryRoutes);
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
      `/auth/sign-in?redirectUrl=${encodeURIComponent(c.req.url)}`,
    );
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
