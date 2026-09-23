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
 * Takes a launch off the url into the store, which the app reads it from for
 * the rest of the tab's life. Called before the url is stripped of it.
 *
 * The launch's own fields, since the search also carries what entry seeded off
 * the caller's row, and writing one of those here posts it straight back. Only
 * the ones the url names, since this runs again on the strip.
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

/**
 * Whether the app is running in an Onshape document it can insert into. A
 * signed-in caller opening the app directly is not.
 */
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

/**
 * `systemTheme` is Onshape's, taken off the launch; standalone there is none,
 * so the caller passes the OS preference instead.
 */
export function getColorTheme(
    theme: Theme,
    systemTheme: ColorTheme
): ColorTheme {
    return theme === Theme.SYSTEM ? systemTheme : theme;
}
