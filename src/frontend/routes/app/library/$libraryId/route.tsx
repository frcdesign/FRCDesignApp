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
     * The url selects the library, so the store follows it. Skipped while the tab
     * is null: being shown the default isn't choosing it.
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

function Library(): ReactNode {
    useAppParamMirror();
    useRestoreInsertMenu();
    return <Outlet />;
}
