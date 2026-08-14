import { createFileRoute, redirect } from "@tanstack/react-router";
import z from "zod";
import { queryClient } from "../../../../query-client";
import {
    contextDataQueryKey,
    getFavoritesQuery,
    getLibraryQuery,
    getSearchDbQuery
} from "../../../../queries";
import {
    DEFAULT_SETTINGS,
    LibraryId,
    type ContextData
} from "../../../../../shared/types";

/** Params can't await, so the saved library is read straight from the cache. */
function getSavedLibraryId(): LibraryId {
    const contextData = queryClient.getQueryData<ContextData>(
        contextDataQueryKey()
    );
    return contextData?.settings.libraryId ?? DEFAULT_SETTINGS.libraryId;
}

export const Route = createFileRoute("/app/library/$libraryId")({
    params: {
        // Parse so the id is typed as a LibraryId everywhere downstream, and so
        // an unknown library never reaches the app shell.
        parse: ({ libraryId }) => {
            const parsed = z.enum(LibraryId).safeParse(libraryId);
            if (!parsed.success) {
                throw redirect({
                    to: "/app/library/$libraryId",
                    params: { libraryId: getSavedLibraryId() }
                });
            }
            return { libraryId: parsed.data };
        },
        stringify: ({ libraryId }) => ({ libraryId })
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
