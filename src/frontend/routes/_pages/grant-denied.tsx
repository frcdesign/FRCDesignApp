import type { JSX } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OpenUrlButton } from "../../components/open-url-button";
import { PageNotice } from "../../components/app-notice";
import { APPLICATIONS_PATH } from "../../lib/url";
import { useOnshapeOrigin } from "../../lib/onshape-params";

export const Route = createFileRoute("/_pages/grant-denied")({
    component: GrantDenied
});

function GrantDenied(): JSX.Element {
    const origin = useOnshapeOrigin();
    const applicationAccessButton = (
        <OpenUrlButton
            text="Open Onshape Applications page"
            url={origin + APPLICATIONS_PATH}
        />
    );

    return (
        <PageNotice
            title="Grant Denied"
            description="You denied the FRCDesignApp access to your documents."
            action={applicationAccessButton}
        />
    );
}
