/**
 * The two places the app is offered to somebody who does not have it, and the
 * one rule deciding whether to: the app is only worth offering outside
 * Onshape's panel, since inside it the caller is already running it.
 */
import { Button } from "@mantine/core";
import { ReactNode } from "react";
import { useIsConnectedToOnshape } from "../lib/onshape-params";
import { Callout } from "./callout";

/** The setup page, as a url rather than a route: see the button below. */
const SETUP_PATH = "/setup";

interface GetAppButtonProps {
    /**
     * Inside a callout, where a filled button would shout over the note it
     * sits in. @default false
     */
    small?: boolean;
}

/** Sends the caller to the setup page; renders nothing inside Onshape. */
export function GetAppButton(props: GetAppButtonProps): ReactNode {
    const { small = false } = props;
    const isConnected = useIsConnectedToOnshape();

    if (isConnected) {
        return null;
    }

    return (
        <Button
            // A plain link rather than a router navigation: one of these sits
            // inside the insert menu, which is a modal outside the route tree,
            // so a client-side move would leave it mounted over the new page —
            // reading search params that route does not have.
            component="a"
            href={SETUP_PATH}
            // Two words and no icon: the navbar's top row is full at a panel's
            // width, and what it takes here comes off the library tabs.
            variant={small ? "default" : "light"}
            size={small ? "xs" : "sm"}
            // The navbar row centers its controls; a small one is laid out by
            // the callout instead.
            my={small ? undefined : "auto"}
        >
            Get app
        </Button>
    );
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
            text="Get the FRCDesignApp to use this part"
            action={<GetAppButton small />}
        />
    );
}
