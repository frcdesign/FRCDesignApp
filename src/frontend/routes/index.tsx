import { createFileRoute, redirect } from "@tanstack/react-router";
import { getUiState, updateUiState } from "../lib/ui-state";
import { showSuccessToast } from "../lib/notifications";
import { RootAppError } from "../components/root-error";

// Direct entry for a user opening the app outside Onshape, and where signing in
// returns to. Onshape's own launch is handled server-side, so it never reaches
// this route.
export const Route = createFileRoute("/")({
    beforeLoad: ({ search }) => {
        const { libraryId, groupId, justSignedIn } = getUiState();
        if (justSignedIn) {
            updateUiState({ justSignedIn: false });
            // Onshape only sends the caller back here on success, so arriving
            // with the flag set is the confirmation.
            showSuccessToast("Signed in to Onshape.");
        }
        // Whatever Onshape launched with rides along; only the path is ours.
        if (groupId) {
            throw redirect({
                to: "/app/library/$libraryId/groups/$groupId",
                params: { libraryId, groupId },
                search
            });
        }
        throw redirect({
            to: "/app/library/$libraryId",
            params: { libraryId },
            search
        });
    },
    errorComponent: RootAppError
});
