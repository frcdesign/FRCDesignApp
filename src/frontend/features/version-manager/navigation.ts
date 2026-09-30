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

/** Whether to point the page out: until somebody first pushes or pulls. */
export function useIsVersionManagerNew(): boolean {
    const hasRun = useHasSeenHint(Hint.RAN_VERSION_JOB);
    const workspace = useTargetWorkspace();
    return workspace !== undefined && !hasRun;
}
