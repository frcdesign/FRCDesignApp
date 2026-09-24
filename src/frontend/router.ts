import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RootAppSpinner } from "./components/root-spinner";

export const router = createRouter({
    routeTree,
    scrollRestoration: true,
    // `/app`'s navbar needs a library in the url.
    notFoundMode: "root",
    defaultPendingComponent: RootAppSpinner
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}
