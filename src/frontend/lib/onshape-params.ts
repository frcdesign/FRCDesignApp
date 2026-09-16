import { Theme } from "@backend/features/settings/settings";
import { getUiState, updateUiState, useGetUiState } from "./ui-state";
import {
    type ColorTheme,
    type OnshapeLaunch,
    type TargetElement,
    toTargetElement
} from "./onshape-launch";

/**
 * Takes a launch off the url into the store, where the app reads it from for
 * the rest of the tab's life. Called before the url is stripped of it.
 */
export function adoptOnshapeLaunch(launch: OnshapeLaunch): void {
    updateUiState(launch);
}

/** What Onshape launched this panel with, as it was stored. */
export function getOnshapeLaunch(): OnshapeLaunch {
    return getUiState();
}

/**
 * The element the panel can insert into, or nothing when there is none — the
 * app opened standalone, or in a document it can only read.
 */
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

/** Onshape's origin, which a client message has to be addressed to. */
export function useOnshapeServer(): string | undefined {
    return useGetUiState().server;
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
