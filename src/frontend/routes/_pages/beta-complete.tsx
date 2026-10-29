import type { JSX } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OpenUrlButton } from "../../components/open-url-button";
import { PageNotice } from "../../components/app-notice";
import { APP_STORE_PATH } from "../../lib/url";
import { useOnshapeOrigin } from "../../lib/onshape-params";

/** Old installs of the beta extension still launch here. */
export const Route = createFileRoute("/_pages/beta-complete")({
    component: BetaComplete
});

function BetaComplete(): JSX.Element {
    const origin = useOnshapeOrigin();
    const frcDesignAppButton = (
        <OpenUrlButton text="FRCDesignApp" url={origin + APP_STORE_PATH} />
    );

    return (
        <PageNotice
            title="The FRCDesignApp Beta has concluded."
            description="The Beta is now over, and the FRCDesignApp has replaced the existing MKCad app. If you don't have the FRCDesignApp, you can get it from the Onshape App Store. Thank you for participating!"
            action={frcDesignAppButton}
        />
    );
}
