import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { getTabPath, isLibraryTab } from "@backend/features/settings/app-tab";
import { getUiState, updateUiState } from "../lib/ui-state";
import { showSuccessToast } from "../lib/notifications";
import { RootAppError } from "../components/root-error";

// Entry from outside Onshape, and where sign-in returns.
export const Route = createFileRoute("/")({
    beforeLoad: ({ search }) => {
        const { tabId, groupId, justSignedIn } = getUiState();
        const tab = tabId ?? DEFAULT_LIBRARY;
        if (justSignedIn) {
            updateUiState({ justSignedIn: false });
            // Onshape only returns here on success.
            showSuccessToast("Signed in to Onshape.");
        }
        // Whatever Onshape launched with rides along; only the path is ours.
        if (!isLibraryTab(tab)) {
            throw redirect({ href: getTabPath(tab), search });
        }
        if (groupId) {
            throw redirect({
                to: "/app/library/$libraryId/groups/$groupId",
                params: { libraryId: tab, groupId },
                search
            });
        }
        throw redirect({
            to: "/app/library/$libraryId",
            params: { libraryId: tab },
            search
        });
    },
    errorComponent: RootAppError
});
