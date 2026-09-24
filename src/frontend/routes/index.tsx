import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { getTabPath, isLibraryTab } from "@backend/features/settings/app-tab";
import { getUiState } from "../lib/ui-state";
import { RootAppError } from "../components/root-error";

// Entry from outside Onshape: resumes the last tab and group.
export const Route = createFileRoute("/")({
    beforeLoad: ({ search }) => {
        const { tabId, groupId } = getUiState();
        const tab = tabId ?? DEFAULT_LIBRARY;
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
