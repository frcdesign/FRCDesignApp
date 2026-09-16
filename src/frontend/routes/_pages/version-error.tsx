import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { OpenUrlButton } from "../../components/open-url-button";
import { PageNotice } from "../../components/app-zero-state";
import { getOnshapeLaunch } from "../../lib/onshape-params";
import { makeUrl } from "../../lib/url";

/**
 * Where a panel opened in a version or a microversion lands. Onshape will
 * launch us in one, but a snapshot cannot be changed, so there is nothing for
 * the app to insert into.
 */
export const Route = createFileRoute("/_pages/version-error")({
    component: VersionError
});

function VersionError(): ReactNode {
    // The launch was taken into the store before the redirect, so the document
    // it named is still here to point at.
    const { documentId } = getOnshapeLaunch();

    return (
        <PageNotice
            title="The FRCDesignApp cannot insert into a version."
            description="A version is a snapshot of a document and cannot be changed. Open the document's workspace and launch the app there."
            action={
                documentId ? (
                    <OpenUrlButton
                        text="Open document"
                        url={makeUrl({ documentId })}
                    />
                ) : undefined
            }
        />
    );
}
