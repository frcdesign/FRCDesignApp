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
import { updateUiState } from "../../../../lib/ui-state";
import { useRestoreInsertMenu } from "../../../../features/insert/restore-insert-menu";

export const Route = createFileRoute("/app/library/$libraryId")({
    component: Library,
    params: {
        parse: ({ libraryId }) => ({ libraryId: parseLibraryId(libraryId) }),
        stringify: ({ libraryId }) => ({ libraryId })
    },
    /**
     * The url is what selects a library, so the store follows it here, as the
     * group below does. Without this the two disagree whenever the app opens
     * anywhere but the store's default — a resume from the caller's row, or a
     * store that came back empty, which is every launch in a panel whose
     * storage Onshape's iframe has partitioned away. Switching back to the
     * library the store still named would then change nothing, post nothing,
     * and leave the row resuming where it always had.
     *
     * Not synced: this value came from the row in the first place, and a
     * switch — which is a change against what is stored here — posts its own.
     */
    onEnter: (match) => {
        updateUiState({ libraryId: match.params.libraryId }, { sync: false });
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
