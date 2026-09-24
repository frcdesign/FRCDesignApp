import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { useIsConnectedToOnshape } from "../lib/onshape-params";
import { IconSize } from "../lib/style-constants";
import { openUrlInNewTab, SETUP_URL } from "../lib/url";
import { Callout } from "./callout";

/** Offers the app where someone sees a part they can't insert. Hidden inside Onshape. */
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
