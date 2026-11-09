import { useMatch } from "@tanstack/react-router";
import { Hint } from "@backend/features/hints/contract";
import { useTargetElement } from "../../lib/onshape-params";
import { useHasSeenHint } from "../hints/queries";

/** Whether Auto Assembly's page is the one showing. */
export function useIsAutoAssembly(): boolean {
    return (
        useMatch({ from: "/app/auto-assembly", shouldThrow: false }) !==
        undefined
    );
}

/** Whether to point the page out: until somebody first opens it. */
export function useIsAutoAssemblyNew(): boolean {
    const hasOpened = useHasSeenHint(Hint.OPENED_AUTO_ASSEMBLY);
    const target = useTargetElement();
    return target !== undefined && !hasOpened;
}
