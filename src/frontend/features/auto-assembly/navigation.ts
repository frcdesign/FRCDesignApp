import { useMatch } from "@tanstack/react-router";

/** Whether Auto Assembly's page is the one showing. */
export function useIsAutoAssembly(): boolean {
    return (
        useMatch({ from: "/app/auto-assembly", shouldThrow: false }) !==
        undefined
    );
}
