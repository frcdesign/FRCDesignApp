import { useMatch } from "@tanstack/react-router";
import { Hint } from "@backend/features/hints/contract";
import { useTargetElement } from "../../lib/onshape-params";
import { useHasSeenHint } from "../hints/queries";

/** Whether the design check's page is the one showing. */
export function useIsDesignCheck(): boolean {
    return (
        useMatch({ from: "/app/design-check", shouldThrow: false }) !==
        undefined
    );
}

/** Whether to point the page out: until somebody first opens it. */
export function useIsDesignCheckNew(): boolean {
    const hasOpened = useHasSeenHint(Hint.OPENED_DESIGN_CHECK);
    const target = useTargetElement();
    return target !== undefined && !hasOpened;
}
