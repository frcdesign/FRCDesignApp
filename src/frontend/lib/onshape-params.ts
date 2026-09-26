/** What Onshape launched this browser tab with, kept for the tab alone. */
import { useMemo } from "react";
import * as z from "zod";
import { useShallow } from "zustand/react/shallow";
import {
    LAUNCH_KEYS,
    type OnshapeLaunch,
    OnshapeLaunchType,
    type TargetElement,
    toTargetElement
} from "./onshape-launch";
import { createPersistedStore } from "./persisted-store";
import { toOnshapeOrigin } from "./url";

/** Per tab, since each browser tab is a different Onshape document. */
export const useOnshapeLaunch = createPersistedStore(
    OnshapeLaunchType.extend({
        /** Set on leaving for Onshape, so the returning tab can confirm the sign-in. */
        justSignedIn: z.boolean().catch(false)
    }),
    "onshapeLaunch",
    () => window.sessionStorage
);

/** Only the fields present: an in-app navigation drops the rest from the url. */
export function adoptOnshapeLaunch(search: OnshapeLaunch): void {
    useOnshapeLaunch.setState(
        Object.fromEntries(
            LAUNCH_KEYS.filter((key) => search[key] !== undefined).map(
                (key) => [key, search[key]]
            )
        )
    );
}

/** The element the panel can insert into; nothing when there is none. */
export function useTargetElement(): TargetElement | undefined {
    const launch = useOnshapeLaunch(
        useShallow((state) => ({
            documentId: state.documentId,
            instanceId: state.instanceId,
            instanceType: state.instanceType,
            elementId: state.elementId,
            elementType: state.elementType
        }))
    );
    return useMemo(() => toTargetElement(launch), [launch]);
}

/** A signed-in caller opening the app directly isn't. */
export function useIsConnectedToOnshape(): boolean {
    return useTargetElement() !== undefined;
}

export function useOnshapeServer(): string | undefined {
    return useOnshapeLaunch((state) => state.server);
}

/** What links into Onshape are built on, so they open on the caller's company. */
export function useOnshapeOrigin(): string {
    return toOnshapeOrigin(useOnshapeServer());
}
