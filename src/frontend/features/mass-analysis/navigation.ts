import { useMatch } from "@tanstack/react-router";

/** Whether Mass Analysis's page is the one showing. */
export function useIsMassAnalysis(): boolean {
    return (
        useMatch({ from: "/app/mass-analysis", shouldThrow: false }) !==
        undefined
    );
}
