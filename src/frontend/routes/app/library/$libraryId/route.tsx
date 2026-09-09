import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ReactNode } from "react";
import { queryClient } from "../../../../lib/query-client";
import { prefetchFavorites } from "../../../../features/favorites/queries";
import {
    getLibraryQuery,
    getLibraryVersionQuery
} from "../../../../features/library/queries";
import { getSearchDbQuery } from "../../../../features/search/queries";
import {
    isComingSoon,
    parseLibraryId,
    useLibraryId
} from "../../../../features/library/library-path";
import { ComingSoon } from "../../../../features/library/components/coming-soon";

export const Route = createFileRoute("/app/library/$libraryId")({
    component: LibraryRoute,
    params: {
        parse: ({ libraryId }) => ({ libraryId: parseLibraryId(libraryId) }),
        stringify: ({ libraryId }) => ({ libraryId })
    },
    loader: async ({ params }) => {
        const { libraryId } = params;
        // Nothing below is rendered, so nothing below is worth fetching.
        if (isComingSoon(libraryId)) {
            return;
        }
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

/** One gate for the whole library: its groups and search render inside it. */
function LibraryRoute(): ReactNode {
    return isComingSoon(useLibraryId()) ? <ComingSoon /> : <Outlet />;
}
