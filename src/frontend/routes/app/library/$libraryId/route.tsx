import { createFileRoute, notFound } from "@tanstack/react-router";
import z from "zod";
import { queryClient } from "../../../../query-client";
import {
    getFavoritesQuery,
    getLibraryQuery,
    getSearchDbQuery
} from "../../../../queries";
import { LibraryId } from "../../../../../shared/types";

export const Route = createFileRoute("/app/library/$libraryId")({
    params: {
        // Parse so the id is typed as a LibraryId everywhere downstream.
        parse: ({ libraryId }) => {
            const parsed = z.enum(LibraryId).safeParse(libraryId);
            if (!parsed.success) {
                throw notFound();
            }
            return { libraryId: parsed.data };
        },
        stringify: ({ libraryId }) => ({ libraryId })
    },
    loader: ({ context, params }) => {
        // Deliberately not awaited: the library's views render spinners while
        // their queries load, so switching libraries swaps the display
        // immediately instead of sitting on the old library's data.
        const { libraryId } = params;
        const cacheVersion = context.accessData.cacheVersion;
        void queryClient.prefetchQuery(
            getLibraryQuery(libraryId, cacheVersion)
        );
        void queryClient.prefetchQuery(
            getSearchDbQuery(libraryId, cacheVersion)
        );
        void queryClient.prefetchQuery(getFavoritesQuery(libraryId));
    }
});
