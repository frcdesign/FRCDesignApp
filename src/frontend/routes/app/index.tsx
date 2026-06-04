import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * A bare `/app` hit (e.g. the backend serving the SPA there) has no settings in
 * search yet, so route through `/init`, which fetches them before forwarding to
 * the document list.
 */
export const Route = createFileRoute("/app/")({
    beforeLoad: () => {
        throw redirect({ to: "/init" });
    }
});
