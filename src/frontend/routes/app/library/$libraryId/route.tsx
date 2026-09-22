import { createFileRoute, Outlet } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { queryClient } from "../../../../lib/query-client";
import { prefetchFavorites } from "../../../../features/favorites/queries";
import {
    getLibraryQuery,
    getLibraryVersionQuery
} from "../../../../features/library/queries";
import { getSearchDbQuery } from "../../../../features/search/queries";
import { parseLibraryId } from "../../../../lib/library";
import { useAppParamMirror } from "../../../../lib/app-params";
import { getUiState, updateUiState } from "../../../../lib/ui-state";
import { useRestoreInsertMenu } from "../../../../features/insert/restore-insert-menu";

export const Route = createFileRoute("/app/library/$libraryId")({
    component: Library,
    params: {
        parse: ({ libraryId }) => ({ libraryId: parseLibraryId(libraryId) }),
        stringify: ({ libraryId }) => ({ libraryId })
    },
    /**
     * A library is a tab, and the url selects it, so the store follows the url
     * here as it does the group. Written by the tabs alone it drifted — a
     * resume lands elsewhere, and a panel whose storage Onshape partitioned
     * away reads as the default — and switching back to the tab it still named
     * then posted nothing, leaving the row where it was.
     *
     * Not while the tab is null: being shown the default is not choosing it.
     */
    onEnter: (match) => {
        if (getUiState().tabId) {
            updateUiState({ tabId: match.params.libraryId }, { sync: false });
        }
    },
    loader: async ({ params }) => {
        const { libraryId } = params;
        // The only awaited fetch: everything below keys its url off the version.
        const cacheVersion = await queryClient.ensureQueryData(
            getLibraryVersionQuery(libraryId)
        );
        void queryClient.prefetchQuery(
            getLibraryQuery(libraryId, cacheVersion)
        );
        void queryClient.prefetchQuery(
            getSearchDbQuery(libraryId, cacheVersion)
        );
        void prefetchFavorites(libraryId);
    }
});

/**
 * The library's pages, plus the two things that follow the library rather than
 * any one of them: the url the app keeps current, and the insert menu it was
 * left with.
 */
function Library(): ReactNode {
    useAppParamMirror();
    useRestoreInsertMenu();
    return <Outlet />;
}
