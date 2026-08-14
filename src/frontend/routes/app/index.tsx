import { createFileRoute, redirect } from "@tanstack/react-router";

/** Sends bare `/app` visits to the user's saved library. */
export const Route = createFileRoute("/app/")({
    beforeLoad: ({ context }) => {
        throw redirect({
            to: "/app/library/$libraryId/groups",
            params: { libraryId: context.settings.libraryId }
        });
    }
});
