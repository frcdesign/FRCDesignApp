import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEFAULT_LIBRARY_ID, DEFAULT_SETTINGS } from "../../shared/types";
import { readLocalSettings } from "../settings/local-settings";
import { RootAppError } from "../app/root-error";

// Direct (not-signed-in) entry point. Onshape launches the app through `/init`
// (redirected server-side); a user opening the app directly lands here and is
// forwarded into the library, seeded from their locally-saved settings.
export const Route = createFileRoute("/")({
    beforeLoad: () => {
        const local = readLocalSettings();
        throw redirect({
            to: "/app/library/$libraryId",
            params: { libraryId: local.libraryId ?? DEFAULT_LIBRARY_ID },
            search: { theme: local.theme ?? DEFAULT_SETTINGS.theme }
        });
    },
    errorComponent: RootAppError
});
