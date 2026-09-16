import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { useIsConnectedToOnshape } from "../lib/onshape-params";
import { IconSize } from "../lib/style-constants";
import { openUrlInNewTab, SETUP_URL } from "../lib/url";
import { Callout } from "./callout";

/**
 * Offers the app over the insert menu's preview, where a part somebody cannot
 * insert is in front of them and the reason why is worth naming. Settings
 * offers it too; the navbar does not, having no room to spare at a phone's
 * width. Inside Onshape's panel the caller is already running the app, so this
 * renders nothing there.
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
                icon: <ArrowSquareOutIcon size={IconSize.SMALL} />,
                onClick: () => openUrlInNewTab(SETUP_URL)
            }}
        />
    );
}
