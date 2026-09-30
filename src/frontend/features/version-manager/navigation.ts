import { useMatch } from "@tanstack/react-router";
import { useTargetWorkspace } from "../../lib/onshape-params";
import { Hint } from "@backend/features/hints/contract";
import { useUiState } from "../../lib/ui-state";
import { useHasSeenHint } from "../hints/queries";
import { useWorkspaceLinksQuery } from "./queries";

/** Whether the version manager's page is the one showing. */
export function useIsVersionManager(): boolean {
    return (
        useMatch({ from: "/app/version-manager", shouldThrow: false }) !==
        undefined
    );
}

/**
 * Whether to point the page out: somebody with a document to act on who has
 * never linked a workspace, has not opened the page in this browser, and finds
 * nothing linked here. The links are only asked for while the answer could
 * still be yes, so this costs an Onshape call once per person, not per page.
 */
export function useIsVersionManagerNew(): boolean {
    const hasOpened = useUiState((state) => state.hasOpenedVersionManager);
    const hasLinked = useHasSeenHint(Hint.LINKED_WORKSPACE);
    const workspace = useTargetWorkspace();
    const isFound = hasOpened || hasLinked;
    const links = useWorkspaceLinksQuery(isFound ? undefined : workspace);

    const data = links.data;
    return (
        !isFound &&
        data !== undefined &&
        data.parents.length === 0 &&
        data.children.length === 0
    );
}
