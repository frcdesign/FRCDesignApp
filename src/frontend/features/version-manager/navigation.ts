import { useMatch } from "@tanstack/react-router";
import { useTargetWorkspace } from "../../lib/onshape-params";
import { useUiState } from "../../lib/ui-state";
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
 * never opened it and has nothing linked. Links of their own are the sign they
 * have found it, whether or not this browser remembers them opening it.
 *
 * The links are only asked for while the answer could still be yes, so this
 * costs an Onshape call once per person rather than on every page.
 */
export function useIsVersionManagerNew(): boolean {
    const hasOpened = useUiState((state) => state.hasOpenedVersionManager);
    const workspace = useTargetWorkspace();
    const links = useWorkspaceLinksQuery(hasOpened ? undefined : workspace);

    const data = links.data;
    return (
        !hasOpened &&
        data !== undefined &&
        data.parents.length === 0 &&
        data.children.length === 0
    );
}
