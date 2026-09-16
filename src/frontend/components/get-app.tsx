import { ReactNode } from "react";
import { useIsConnectedToOnshape } from "../lib/onshape-params";
import { openUrlInNewTab } from "../lib/url";
import { Callout } from "./callout";

/**
 * The setup instructions, opened in a window of their own like the dashboard.
 * A navigation would take the insert menu this is offered from with it, and
 * the part being looked at is why somebody would want the app in the first
 * place.
 */
const SETUP_URL = "/setup";

/**
 * Offers the app over the insert menu's preview, where a part somebody cannot
 * insert is in front of them and the reason why is worth naming. The one place
 * it is offered: the navbar has no room to spare at a phone's width, and inside
 * Onshape's panel the caller is already running the app, so this renders
 * nothing there.
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
