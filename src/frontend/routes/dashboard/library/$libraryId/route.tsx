import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";

function isLibraryId(libraryId: string): libraryId is LibraryId {
    return (Object.values(LibraryId) as string[]).includes(libraryId);
}

export const Route = createFileRoute("/dashboard/library/$libraryId")({
    component: LibraryLayout,
    params: {
        // Narrowed by beforeLoad, which rejects an unknown library outright.
        parse: ({ libraryId }) => ({ libraryId: libraryId as LibraryId }),
        stringify: ({ libraryId }) => ({ libraryId })
    },
    // A bad library id in the URL should fail here rather than reach the API.
    beforeLoad: ({ params }) => {
        // Widened back out: parse() asserts the type, this is what checks it.
        const libraryId: string = params.libraryId;
        if (!isLibraryId(libraryId)) {
            throw notFound();
        }
    }
});

function LibraryLayout(): ReactNode {
    return <Outlet />;
}
