import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AppLoading } from "./app/app-loading";

export const router = createRouter({
    routeTree,
    scrollRestoration: true,
    // Render misses at the root instead of inside `/app`, whose navbar needs a
    // library in the url to render at all.
    notFoundMode: "root",
    // The root Suspense boundary falls back to nothing otherwise, so a pending
    // match on the way in would paint a blank page.
    defaultPendingComponent: AppLoading
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}
