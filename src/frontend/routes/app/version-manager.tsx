import { createFileRoute, redirect } from "@tanstack/react-router";
import { Stack } from "@mantine/core";
import { type ReactNode } from "react";
import {
    LinkDirection,
    type WorkspaceLinksData,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { SectionLoading, SectionNotice } from "../../components/app-zero-state";
import { getUiState } from "../../lib/ui-state";
import { toTargetWorkspace } from "../../lib/onshape-launch";
import { useTargetWorkspace } from "../../lib/onshape-params";
import { LinkedWorkspaceSection } from "../../features/version-manager/components/linked-workspace-section";
import { VersionJobStatus } from "../../features/version-manager/components/version-job-status";
import { useWorkspaceLinksQuery } from "../../features/version-manager/queries";
import { useIsSignedIn } from "../../features/auth/access-level";

export const Route = createFileRoute("/app/version-manager")({
    component: VersionManagerPage,
    beforeLoad: () => {
        // Nothing to act on: the tab that leads here is hidden without a
        // workspace, so this only catches a url typed or restored by hand.
        if (!toTargetWorkspace(getUiState())) {
            throw redirect({ to: "/", replace: true });
        }
    }
});

function VersionManagerPage(): ReactNode {
    const workspace = useTargetWorkspace();
    const isSignedIn = useIsSignedIn();

    if (!workspace) {
        // The redirect above has already been thrown; this is what renders on
        // the way out.
        return <SectionLoading title="Loading..." />;
    }
    if (!isSignedIn) {
        return (
            <SectionNotice
                title="Sign in to manage versions."
                description="Linking workspaces and pushing versions both happen in your Onshape documents, which needs your Onshape session."
            />
        );
    }
    return <VersionManager workspace={workspace} />;
}

interface VersionManagerProps {
    workspace: WorkspacePath;
}

/**
 * The two link lists, each owning its own push or pull: there is no page-level
 * action, because every action belongs to one direction or one row.
 */
function VersionManager(props: VersionManagerProps): ReactNode {
    const { workspace } = props;
    const linksQuery = useWorkspaceLinksQuery(workspace);

    if (linksQuery.isPending) {
        return <SectionLoading title="Loading linked workspaces..." />;
    }
    if (linksQuery.isError || !linksQuery.data) {
        return <SectionNotice title="Failed to load linked workspaces." />;
    }

    const links: WorkspaceLinksData = linksQuery.data;

    return (
        <Stack p="sm" gap="lg">
            <VersionJobStatus workspace={workspace} />
            <LinkedWorkspaceSection
                workspace={workspace}
                direction={LinkDirection.PARENT}
                linked={links.parents}
            />
            <LinkedWorkspaceSection
                workspace={workspace}
                direction={LinkDirection.CHILD}
                linked={links.children}
            />
        </Stack>
    );
}
