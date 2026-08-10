import { createFileRoute, redirect } from "@tanstack/react-router";
import { getUiState } from "../api-utils/ui-state";
import { RootAppError } from "../app/root-error";

// Direct (not-signed-in) entry point. Onshape launches the app via `/init`; a
// user opening the app directly lands here and is forwarded into the library.
export const Route = createFileRoute("/")({
    beforeLoad: () => {
        const uiState = getUiState();
        if (uiState.openGroupId) {
            throw redirect({
                to: "/app/groups/$groupId",
                params: { groupId: uiState.openGroupId }
            });
        }
        throw redirect({ to: "/app/groups" });
    },
    errorComponent: RootAppError
});
