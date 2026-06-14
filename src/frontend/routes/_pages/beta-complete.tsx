import type { JSX } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OpenUrlButton } from "../../common/open-url-button";
import { PageError } from "../../app-common/app-zero-state";

export const Route = createFileRoute("/_pages/beta-complete")({
    component: BetaComplete
});

const URL =
    "https://cad.onshape.com/appstore/apps/Manufacturers%20Models/6004ec5e83c40b107c183347";

function BetaComplete(): JSX.Element {
    const frcDesignAppButton = <OpenUrlButton text="FRCDesignApp" url={URL} />;

    return (
        <PageError
            title="The FRCDesignApp Beta has concluded."
            description="The Beta is now over, and the FRCDesignApp has replaced the existing MKCad app. If you don't have the MKCad app, you can get it from the Onshape App Store. Thank you for participating!"
            action={frcDesignAppButton}
        />
    );
}
