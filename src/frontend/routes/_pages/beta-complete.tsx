import type { JSX } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OpenUrlButton } from "../../components/open-url-button";
import { PageNotice } from "../../components/app-zero-state";
import { APP_STORE_URL } from "../../lib/url";

/**
 * Where the beta-era app extension still points. Nothing links here anymore,
 * but an install old enough to predate the cutover launches straight at it, and
 * without this route those callers land on the not-found page instead.
 */
export const Route = createFileRoute("/_pages/beta-complete")({
    component: BetaComplete
});

function BetaComplete(): JSX.Element {
    const frcDesignAppButton = (
        <OpenUrlButton text="FRCDesignApp" url={APP_STORE_URL} />
    );

    return (
        <PageNotice
            title="The FRCDesignApp Beta has concluded."
            description="The Beta is now over, and the FRCDesignApp has replaced the existing MKCad app. If you don't have the FRCDesignApp, you can get it from the Onshape App Store. Thank you for participating!"
            action={frcDesignAppButton}
        />
    );
}
