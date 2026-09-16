import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { PageNotice } from "../../components/app-zero-state";

/**
 * Where a panel opened in a version or a microversion lands. Onshape launches
 * us in one happily enough, but a snapshot cannot be changed, so there is
 * nothing for the app to insert into.
 */
export const Route = createFileRoute("/_pages/version-error")({
    component: VersionError
});

function VersionError(): ReactNode {
    return (
        <PageNotice
            title="The FRCDesignApp cannot insert into a version."
            description="A version is a snapshot of a document and cannot be changed. Open the document's workspace and launch the app there."
        />
    );
}
