import { useMatch } from "@tanstack/react-router";

/** Whether the version manager's page is the one showing. */
export function useIsVersionManager(): boolean {
    return (
        useMatch({ from: "/app/version-manager", shouldThrow: false }) !==
        undefined
    );
}
