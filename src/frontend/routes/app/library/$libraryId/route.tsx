import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { queryClient } from "../../../../lib/query-client";
import { getAccessDataQuery } from "../../../../features/auth/access-level";
import { getFavoritesQuery } from "../../../../features/favorites/queries";
import {
    getLibraryQuery,
    getLibraryVersionQuery
} from "../../../../features/library/queries";
import { getSearchDbQuery } from "../../../../features/search/queries";
import { LibraryId } from "@backend/features/library/library-id";
import { getUiState } from "../../../../lib/ui-state";
import { isLibraryId } from "../../../../features/library/library-path";

/** Restoring the last group is an entry behavior, so it happens once per load. */
let restoredGroup = false;

export const Route = createFileRoute("/app/library/$libraryId")({
    params: {
        // Narrowed by beforeLoad, which 404s an unknown library.
        parse: ({ libraryId }) => ({ libraryId: libraryId as LibraryId }),
        stringify: ({ libraryId }) => ({ libraryId })
    },
    beforeLoad: ({ params }) => {
        // Quietly showing a different library would hide the bad url and leave
        // the caller wondering why they are somewhere else.
        if (!isLibraryId(params.libraryId)) {
            throw notFound();
        }
        // Client state, so the entry redirect can't restore it.
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
        // Favorites are per-user, so the endpoint 401s a signed-out caller.
        void queryClient
            .ensureQueryData(getAccessDataQuery())
            .then((accessData) => {
                if (accessData.signedIn) {
                    void queryClient.prefetchQuery(
                        getFavoritesQuery(libraryId)
                    );
                }
            });
    }
});
