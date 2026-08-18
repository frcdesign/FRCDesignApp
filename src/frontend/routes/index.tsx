import { createFileRoute, redirect } from "@tanstack/react-router";
import { readLocalSettings } from "../settings/local-settings";
import { RootAppError } from "../app/root-error";

// Direct entry for a user opening the app outside Onshape. Onshape's own launch
// is handled server-side, so it never reaches this route.
export const Route = createFileRoute("/")({
    beforeLoad: () => {
        const { libraryId, theme } = readLocalSettings();
        throw redirect({
            to: "/app/library/$libraryId",
            params: { libraryId },
            search: { theme }
        });
    },
    errorComponent: RootAppError
});
