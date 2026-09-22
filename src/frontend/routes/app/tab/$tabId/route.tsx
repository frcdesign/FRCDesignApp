import { createFileRoute, Outlet } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { isLibraryTab } from "@backend/features/settings/app-tab";
import { queryClient } from "../../../../lib/query-client";
import { prefetchFavorites } from "../../../../features/favorites/queries";
import {
    getLibraryQuery,
    getLibraryVersionQuery
} from "../../../../features/library/queries";
import { getSearchDbQuery } from "../../../../features/search/queries";
import { parseTabId } from "../../../../lib/tabs";
import { useAppParamMirror } from "../../../../lib/app-params";
import { updateUiState } from "../../../../lib/ui-state";
import { useRestoreInsertMenu } from "../../../../features/insert/restore-insert-menu";

export const Route = createFileRoute("/app/tab/$tabId")({
    component: Tab,
    params: {
        parse: ({ tabId }) => ({ tabId: parseTabId(tabId) }),
        stringify: ({ tabId }) => ({ tabId })
    },
    /**
     * The url is what selects a tab, so the store follows it here, as the group
     * below does. Without this the two disagree whenever the app opens anywhere
     * but the store's default — a resume from the caller's row, or a store that
     * came back empty, which is every launch in a panel whose storage Onshape's
     * iframe has partitioned away. Switching back to the tab the store still
     * named would then change nothing, post nothing, and leave the row resuming
     * where it always had.
     *
     * Not synced: this value came from the row in the first place, and a
     * switch — which is a change against what is stored here — posts its own.
     */
    onEnter: (match) => {
        updateUiState({ tabId: match.params.tabId }, { sync: false });
    },
    loader: async ({ params }) => {
        const { tabId } = params;
        // Only a library has a library to warm. Nothing else can be reached
        // yet, so this is the type saying so rather than a case being handled.
        if (!isLibraryTab(tabId)) {
            return;
        }
        // The only awaited fetch: everything below keys its url off the version.
        const cacheVersion = await queryClient.ensureQueryData(
            getLibraryVersionQuery(tabId)
        );
        void queryClient.prefetchQuery(getLibraryQuery(tabId, cacheVersion));
        void queryClient.prefetchQuery(getSearchDbQuery(tabId, cacheVersion));
        void prefetchFavorites(tabId);
    }
});

/**
 * The tab's pages, plus the two things that follow the tab rather than any one
 * of them: the url the app keeps current, and the insert menu it was left with.
 */
function Tab(): ReactNode {
    useAppParamMirror();
    useRestoreInsertMenu();
    return <Outlet />;
}
