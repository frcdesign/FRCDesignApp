import { createFileRoute, Outlet } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { queryClient } from "../../../../lib/query-client";
import { parseLibraryId } from "../../../../lib/library";
import { getLibraryVersionQuery } from "../../../../features/library/queries";

export const Route = createFileRoute("/dashboard/library/$libraryId")({
    component: LibraryLayout,
    params: {
        parse: ({ libraryId }) => ({ libraryId: parseLibraryId(libraryId) }),
        stringify: ({ libraryId }) => ({ libraryId })
    },
    // Awaited, so version-keyed queries don't fetch at zero first.
    loader: ({ params }) =>
        queryClient.ensureQueryData(getLibraryVersionQuery(params.libraryId))
});

function LibraryLayout(): ReactNode {
    return <Outlet />;
}
