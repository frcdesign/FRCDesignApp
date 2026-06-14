import type { JSX } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OpenUrlButton } from "../../common/open-url-button";
import { PageError } from "../../app-common/app-zero-state";

export const Route = createFileRoute("/_pages/safari-error")({
    component: SafariError
});

const URL =
    "https://support.apple.com/guide/safari/prevent-cross-site-tracking-sfri40732/mac";

function SafariError(): JSX.Element {
    const applicationAccessButton = (
        <OpenUrlButton text="More information" url={URL} />
    );

    return (
        <PageError
            title="Failed to Authenticate in Safari."
            description="The FRCDesignApp does not work on Safari unless you manually disable 'Prevent cross-site tracking' in your browser settings."
            action={applicationAccessButton}
        />
    );
}
