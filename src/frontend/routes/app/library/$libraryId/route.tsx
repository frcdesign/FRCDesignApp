import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryClient } from "../../../../query-client";
import {
    getFavoritesQuery,
    getLibraryQuery,
    getLibraryVersionsQuery,
    getSearchDbQuery
} from "../../../../queries";
import { LibraryId } from "../../../../../shared/types";
import { getUiState } from "../../../../api-utils/ui-state";

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
                params: { libraryId: getUiState().libraryId }
            });
        }
    },
    loader: async ({ params }) => {
        const { libraryId } = params;
        // The only awaited fetch: everything below keys its url off the version.
        const versions = await queryClient.ensureQueryData(
            getLibraryVersionsQuery()
        );
        const cacheVersion = versions[libraryId] ?? 0;
        void queryClient.prefetchQuery(
            getLibraryQuery(libraryId, cacheVersion)
        );
        void queryClient.prefetchQuery(
            getSearchDbQuery(libraryId, cacheVersion)
        );
        void queryClient.prefetchQuery(getFavoritesQuery(libraryId));
    }
});
