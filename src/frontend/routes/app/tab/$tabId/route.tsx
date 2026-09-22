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
import { getUiState, updateUiState } from "../../../../lib/ui-state";
import { useRestoreInsertMenu } from "../../../../features/insert/restore-insert-menu";

export const Route = createFileRoute("/app/tab/$tabId")({
    component: Tab,
    params: {
        parse: ({ tabId }) => ({ tabId: parseTabId(tabId) }),
        stringify: ({ tabId }) => ({ tabId })
    },
    /**
     * The url selects the tab, so the store follows it, as it does the group.
     * Written by the tabs alone it drifted from the url — a resume lands
     * elsewhere, and a panel whose storage Onshape partitioned away reads as
     * the default — and switching back to the tab it still named then posted
     * nothing, leaving the row where it was.
     *
     * Not while the tab is null: being shown the default is not choosing it.
     */
    onEnter: (match) => {
        if (getUiState().tabId) {
            updateUiState({ tabId: match.params.tabId }, { sync: false });
        }
    },
    loader: async ({ params }) => {
        const { tabId } = params;
        // Only a library has one to warm; nothing else can be reached yet.
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
