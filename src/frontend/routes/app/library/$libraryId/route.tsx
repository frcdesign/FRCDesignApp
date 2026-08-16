import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryClient } from "../../../../query-client";
import {
    getFavoritesQuery,
    getLibraryQuery,
    getLibraryVersionQuery,
    getSearchDbQuery
} from "../../../../queries";
import { DEFAULT_LIBRARY_ID, LibraryId } from "../../../../../shared/types";
import { getUiState } from "../../../../api-utils/ui-state";

/** Restoring the last group is an entry behavior, so it happens once per load. */
let restoredGroup = false;

function isLibraryId(libraryId: string): libraryId is LibraryId {
    return (Object.values(LibraryId) as string[]).includes(libraryId);
}

export const Route = createFileRoute("/app/library/$libraryId")({
    params: {
        // Narrowed by beforeLoad, which sends an unknown library elsewhere.
        parse: ({ libraryId }) => ({ libraryId: libraryId as LibraryId }),
        stringify: ({ libraryId }) => ({ libraryId })
    },
    beforeLoad: ({ params }) => {
        if (!isLibraryId(params.libraryId)) {
            throw redirect({
                to: "/app/library/$libraryId",
                params: { libraryId: DEFAULT_LIBRARY_ID }
            });
        }
        // The group the user last had open is client state, so the entry
        // redirect can't restore it; do it on the way into the library.
        const { openGroupId } = getUiState();
        if (openGroupId && !restoredGroup) {
            restoredGroup = true;
            throw redirect({
                to: "/app/library/$libraryId/groups/$groupId",
                params: { libraryId: params.libraryId, groupId: openGroupId }
            });
        }
        restoredGroup = true;
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
        void queryClient.prefetchQuery(getFavoritesQuery(libraryId));
    }
});
