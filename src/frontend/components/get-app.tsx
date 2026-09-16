/**
 * The two places the app is offered to somebody who does not have it, and the
 * one rule deciding whether to: the app is only worth offering outside
 * Onshape's panel, since inside it the caller is already running it.
 */
import { ReactNode } from "react";
import { useIsConnectedToOnshape } from "../lib/onshape-params";
import { openUrlInNewTab } from "../lib/url";
import { Callout } from "./callout";
import { OpenUrlButton } from "./open-url-button";

/**
 * The setup instructions, opened in a window of their own like the dashboard:
 * the app is what the caller came for, and one of these sits inside the insert
 * menu, which a navigation would close.
 */
const SETUP_URL = "/setup";

/** Offers the setup page; renders nothing inside Onshape. */
export function GetAppButton(): ReactNode {
    const isConnected = useIsConnectedToOnshape();

    if (isConnected) {
        return null;
    }

    return <OpenUrlButton text="Get app" url={SETUP_URL} />;
}

/**
 * The same offer over the insert menu's preview, where a part somebody cannot
 * insert is in front of them and the reason why is worth naming.
 */
export function GetAppCallout(): ReactNode {
    const isConnected = useIsConnectedToOnshape();

    if (isConnected) {
        return null;
    }

    return (
        <Callout
            text="To use this part, get the FRCDesignApp"
            action={{
                text: "Instructions",
                onClick: () => openUrlInNewTab(SETUP_URL)
            }}
        />
    );
}
