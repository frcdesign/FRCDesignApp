import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { updateUiState, useUiState } from "./ui-state";
import {
    LAUNCH_KEYS,
    type OnshapeLaunch,
    type TargetElement,
    toTargetElement
} from "./onshape-launch";
import { toOnshapeOrigin } from "./url";

/** Only the fields present: an in-app navigation drops the rest from the url. */
export function adoptOnshapeLaunch(search: OnshapeLaunch): void {
    updateUiState(
        Object.fromEntries(
            LAUNCH_KEYS.filter((key) => search[key] !== undefined).map(
                (key) => [key, search[key]]
            )
        )
    );
}

/** The element the panel can insert into; nothing when there is none. */
export function useTargetElement(): TargetElement | undefined {
    const launch = useUiState(
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
    return useUiState((state) => state.server);
}

/** What links into Onshape are built on, so they open on the caller's company. */
export function useOnshapeOrigin(): string {
    return toOnshapeOrigin(useOnshapeServer());
}
