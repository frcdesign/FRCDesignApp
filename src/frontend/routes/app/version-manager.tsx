import { createFileRoute, redirect } from "@tanstack/react-router";
import { Button, Group, Menu, Stack } from "@mantine/core";
import {
    ArrowLineDownIcon,
    ArrowLineUpIcon,
    ArrowsClockwiseIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    LinkDirection,
    type WorkspaceLinksData,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { SectionLoading, SectionNotice } from "../../components/app-zero-state";
import { MenuButton, MenuSection } from "../../components/app-menu";
import { IconSize } from "../../lib/style-constants";
import { getUiState } from "../../lib/ui-state";
import { toTargetWorkspace } from "../../lib/onshape-launch";
import { useTargetWorkspace } from "../../lib/onshape-params";
import { LinkedWorkspaceList } from "../../features/version-manager/components/linked-workspace-list";
import { VersionJobStatus } from "../../features/version-manager/components/version-job-status";
import { openPushVersionModal } from "../../features/version-manager/open-push-version-modal";
import {
    useIsVersionJobRunning,
    usePullReferencesMutation,
    useWorkspaceLinksQuery
} from "../../features/version-manager/queries";
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

function VersionManager(props: VersionManagerProps): ReactNode {
    const { workspace } = props;
    const linksQuery = useWorkspaceLinksQuery(workspace);
    const pull = usePullReferencesMutation(workspace);
    const isRunning = useIsVersionJobRunning(workspace);

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
            <Group gap="sm">
                <Button
                    variant="light"
                    leftSection={<ArrowLineUpIcon size={IconSize.SMALL} />}
                    disabled={isRunning}
                    onClick={() =>
                        openPushVersionModal(workspace, links.downstream)
                    }
                >
                    Push version
                </Button>
                <Button
                    variant="light"
                    leftSection={<ArrowLineDownIcon size={IconSize.SMALL} />}
                    loading={pull.isPending}
                    disabled={isRunning || links.upstream.length === 0}
                    onClick={() => pull.mutate("linked")}
                >
                    Pull latest
                </Button>
                <MenuButton large>
                    <MenuSection label="Pull">
                        {/* Every out-of-date reference, linked or not, which is
                            the one thing the links cannot express. */}
                        <Menu.Item
                            leftSection={
                                <ArrowsClockwiseIcon size={IconSize.MEDIUM} />
                            }
                            disabled={isRunning}
                            onClick={() => pull.mutate("all")}
                        >
                            Update all references
                        </Menu.Item>
                    </MenuSection>
                </MenuButton>
            </Group>
            <LinkedWorkspaceList
                workspace={workspace}
                direction={LinkDirection.UPSTREAM}
                title="Pulls from"
                description="Workspaces this one references. Pulling moves this workspace's references onto their newest versions."
                placeholder="Link to a workspace this one uses..."
                linked={links.upstream}
                emptyMessage="No workspaces linked upstream."
            />
            <LinkedWorkspaceList
                workspace={workspace}
                direction={LinkDirection.DOWNSTREAM}
                title="Pushes to"
                description="Workspaces that reference this one. Pushing creates a version here and moves their references onto it."
                placeholder="Link to a workspace that uses this one..."
                linked={links.downstream}
                emptyMessage="No workspaces linked downstream."
            />
        </Stack>
    );
}
