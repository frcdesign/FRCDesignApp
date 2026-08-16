import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryClient } from "../../../../query-client";
import {
    getFavoritesQuery,
    getLibraryQuery,
    getSearchDbQuery
} from "../../../../queries";
import { LibraryId } from "../../../../../shared/types";

function isLibraryId(libraryId: string): libraryId is LibraryId {
    return (Object.values(LibraryId) as string[]).includes(libraryId);
}

export const Route = createFileRoute("/app/library/$libraryId")({
    params: {
        // Narrowed by beforeLoad, which sends an unknown library elsewhere.
        parse: ({ libraryId }) => ({ libraryId: libraryId as LibraryId }),
        stringify: ({ libraryId }) => ({ libraryId })
    },
    beforeLoad: ({ context, params }) => {
        if (!isLibraryId(params.libraryId)) {
            throw redirect({
                to: "/app/library/$libraryId",
                params: { libraryId: context.settings.libraryId }
            });
        }
    },
    loader: ({ context, params }) => {
        const { libraryId } = params;
        const cacheVersion = context.cacheVersions[libraryId] ?? 0;
        void queryClient.prefetchQuery(
            getLibraryQuery(libraryId, cacheVersion)
        );
        void queryClient.prefetchQuery(
            getSearchDbQuery(libraryId, cacheVersion)
        );
        void queryClient.prefetchQuery(getFavoritesQuery(libraryId));
    }
});
