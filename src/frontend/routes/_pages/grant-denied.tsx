import type { JSX } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OpenUrlButton } from "../../common/open-url-button";
import { PageError } from "../../common/app-zero-state";

export const Route = createFileRoute("/_pages/grant-denied")({
    component: GrantDenied
});

const URL = "https://cad.onshape.com/user/applications";

function GrantDenied(): JSX.Element {
    const applicationAccessButton = (
        <OpenUrlButton text="Open Onshape Applications page" url={URL} />
    );

    return (
        <PageError
            title="Grant Denied"
            description="You denied the FRCDesignApp access to your documents."
            action={applicationAccessButton}
        />
    );
}
