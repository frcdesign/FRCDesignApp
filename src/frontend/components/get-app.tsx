import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { useIsConnectedToOnshape } from "../lib/onshape-params";
import { IconSize } from "../lib/style-constants";
import { openUrlInNewTab, SETUP_URL } from "../lib/url";
import { Callout } from "./callout";

/**
 * Offers the app over the insert menu's preview, where a part somebody cannot
 * insert is in front of them. Inside Onshape's panel they are already running
 * it, so nothing renders there.
 */
export function GetAppCallout(): ReactNode {
    const isConnected = useIsConnectedToOnshape();

    if (isConnected) {
        return null;
    }

    return (
        <Callout
            text="To use this part, get the FRCDesignApp."
            action={{
                text: "Instructions",
                icon: <ArrowSquareOutIcon size={IconSize.SMALL} />,
                onClick: () => openUrlInNewTab(SETUP_URL)
            }}
        />
    );
}
