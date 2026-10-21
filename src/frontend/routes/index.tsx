import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { isLibraryTab, UtilityTab } from "../lib/app-tab";
import { OnshapeLaunchType, toTargetWorkspace } from "../lib/onshape-launch";
import { apiPost } from "../lib/api-client";
import { getUiState } from "../lib/ui-state";
import { RootAppError } from "../components/root-error";

// Entry, from Onshape's /init or opened directly: resumes the last tab and group.
export const Route = createFileRoute("/")({
    beforeLoad: ({ search }) => {
        const { tabId, groupId } = getUiState();
        // A utility page the launch gives nothing to act on is not resumed
        // into: the version manager would send them straight back here.
        const resumable =
            tabId && (isLibraryTab(tabId) || canResume(tabId, search));
        const tab = resumable ? tabId : DEFAULT_LIBRARY;
        // Only launches from Onshape count as opens.
        if ("documentId" in search) {
            // Signed out is refused, and there's no open to count.
            void apiPost("/app-open").catch(() => undefined);
        }
        // Whatever Onshape launched with rides along; only the path is ours.
        // By `to`, since an `href` carries its own search and drops this one.
        if (!isLibraryTab(tab)) {
            throw redirect({ to: utilityRoute(tab), search });
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

function utilityRoute(tab: UtilityTab) {
    switch (tab) {
        case UtilityTab.VERSION_MANAGER:
            return "/app/version-manager" as const;
    }
}

/**
 * Whether a utility page has what it acts on. The version manager acts on the
 * workspace Onshape launched the app in, and there is no page without one.
 */
function canResume(tab: UtilityTab, search: Record<string, unknown>): boolean {
    switch (tab) {
        case UtilityTab.VERSION_MANAGER:
            return (
                toTargetWorkspace(OnshapeLaunchType.parse(search)) !== undefined
            );
    }
}
