import { Theme } from "@backend/features/settings/settings";
import { updateUiState, useGetUiState } from "./ui-state";
import {
    type ColorTheme,
    LAUNCH_KEYS,
    type OnshapeLaunch,
    type TargetElement,
    toTargetElement
} from "./onshape-launch";
import { toOnshapeOrigin } from "./url";

/**
 * Only the launch's own fields, and only those present: the search also
 * carries what entry seeded, which would otherwise post straight back.
 */
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
    return toTargetElement(useGetUiState());
}

/** A signed-in caller opening the app directly isn't. */
export function useIsConnectedToOnshape(): boolean {
    return useTargetElement() !== undefined;
}

export function useOnshapeServer(): string | undefined {
    return useGetUiState().server;
}

/** What links into Onshape are built on, so they open on the caller's company. */
export function useOnshapeOrigin(): string {
    return toOnshapeOrigin(useOnshapeServer());
}

/** `systemTheme` comes from Onshape; standalone passes the OS preference. */
export function getColorTheme(
    theme: Theme,
    systemTheme: ColorTheme
): ColorTheme {
    return theme === Theme.SYSTEM ? systemTheme : theme;
}
