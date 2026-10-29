import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { PageNotice } from "../../components/app-notice";

/** A version can't be changed, so there's nothing to insert into. */
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
