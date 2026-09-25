import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { getTabPath, isLibraryTab } from "../lib/app-tab";
import { apiPost } from "../lib/api-client";
import { toLibraryPath } from "../lib/api-paths";
import { getUiState } from "../lib/ui-state";
import { RootAppError } from "../components/root-error";

// Entry, from Onshape's /init or opened directly: resumes the last tab and group.
export const Route = createFileRoute("/")({
    beforeLoad: ({ search }) => {
        const { tabId, groupId } = getUiState();
        const tab = tabId ?? DEFAULT_LIBRARY;
        // Only launches from Onshape count as opens, and only in a library.
        if ("documentId" in search && isLibraryTab(tab)) {
            // Signed out is refused, and there's no open to count.
            void apiPost("/app-open" + toLibraryPath(tab)).catch(
                () => undefined
            );
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
