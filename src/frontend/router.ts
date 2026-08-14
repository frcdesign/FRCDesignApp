import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
    routeTree,
    scrollRestoration: true,
    // Render misses at the root instead of inside `/app`, whose navbar needs a
    // library in the url to render at all.
    notFoundMode: "root"
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}
