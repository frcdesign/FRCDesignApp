import { app } from "./app";
import { isAuthenticated } from "./auth";
import { userRoutes } from "./api/user";
import { libraryRoutes } from "./api/library";
import { thumbnailRoutes } from "./api/thumbnails";
import { documentRoutes } from "./api/documents";
import { configurationRoutes } from "./api/configurations";

// Mount all API routes
app.route("/api", userRoutes);
app.route("/api", libraryRoutes);
app.route("/api", thumbnailRoutes);
app.route("/api", documentRoutes);
app.route("/api", configurationRoutes);

app.get("/app", async (c) => {
  if (!(await isAuthenticated(c))) {
    return c.redirect(
      `/auth/sign-in?redirectUrl=${encodeURIComponent(c.req.url)}`,
    );
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
