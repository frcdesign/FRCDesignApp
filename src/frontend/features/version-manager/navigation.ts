import { useMatch } from "@tanstack/react-router";
import { useTargetWorkspace } from "../../lib/onshape-params";
import { Hint } from "@backend/features/hints/contract";
import { useHasSeenHint } from "../hints/queries";

/** Whether the version manager's page is the one showing. */
export function useIsVersionManager(): boolean {
    return (
        useMatch({ from: "/app/version-manager", shouldThrow: false }) !==
        undefined
    );
}

/** Whether to point the page out: until somebody first links, pushes or pulls. */
export function useIsVersionManagerNew(): boolean {
    const hasUsed = useHasSeenHint(Hint.USED_VERSION_MANAGER);
    const workspace = useTargetWorkspace();
    return workspace !== undefined && !hasUsed;
}
