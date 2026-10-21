import { useMatch } from "@tanstack/react-router";

/** Whether Quick fastener's page is the one showing. */
export function useIsQuickFastener(): boolean {
    return (
        useMatch({ from: "/app/quick-fastener", shouldThrow: false }) !==
        undefined
    );
}
