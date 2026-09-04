import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { ReactNode } from "react";
import { queryClient } from "../../../../lib/query-client";
import { getFavoritesQuery } from "../../../../features/favorites/queries";
import {
    getLibraryQuery,
    getLibraryVersionQuery
} from "../../../../features/library/queries";
import { getSearchDbQuery } from "../../../../features/search/queries";
import { LibraryId } from "@backend/features/library/library-id";
import {
    isComingSoon,
    isLibraryId,
    useLibraryId
} from "../../../../features/library/library-path";
import { ComingSoon } from "../../../../features/library/components/coming-soon";

export const Route = createFileRoute("/app/library/$libraryId")({
    component: LibraryRoute,
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
        void queryClient.prefetchQuery(getFavoritesQuery(libraryId));
    }
});

/** One gate for the whole library: its groups and search render inside it. */
function LibraryRoute(): ReactNode {
    return isComingSoon(useLibraryId()) ? <ComingSoon /> : <Outlet />;
}
