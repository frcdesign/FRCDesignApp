import { useMatch } from "@tanstack/react-router";

/** Whether the FeatureScripts tab, its list or one feature, is the one showing. */
export function useIsFeatureScripts(): boolean {
    return (
        useMatch({ from: "/app/featurescripts", shouldThrow: false }) !==
        undefined
    );
}
