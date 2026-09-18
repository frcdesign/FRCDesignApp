import { Theme } from "@backend/features/settings/settings";
import { updateUiState, useGetUiState } from "./ui-state";
import {
    type ColorTheme,
    type OnshapeLaunch,
    type TargetElement,
    toTargetElement,
    toTargetWorkspace
} from "./onshape-launch";
import { type WorkspacePath } from "@backend/features/version-manager/contract";

/**
 * Takes a launch off the url into the store, which the app reads it from for
 * the rest of the tab's life. Called before the url is stripped of it.
 */
export function adoptOnshapeLaunch(launch: OnshapeLaunch): void {
    updateUiState(launch);
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

/** The workspace the panel was opened in; nothing when it was opened outside one. */
export function useTargetWorkspace(): WorkspacePath | undefined {
    return toTargetWorkspace(useGetUiState());
}

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
