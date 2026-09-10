import { createFileRoute, Outlet } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { parseLibraryId } from "../../../../features/library/library-path";

export const Route = createFileRoute("/dashboard/library/$libraryId")({
    component: LibraryLayout,
    params: {
        parse: ({ libraryId }) => ({ libraryId: parseLibraryId(libraryId) }),
        stringify: ({ libraryId }) => ({ libraryId })
    }
});

function LibraryLayout(): ReactNode {
    return <Outlet />;
}
