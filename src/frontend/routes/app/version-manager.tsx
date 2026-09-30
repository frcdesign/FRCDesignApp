import { createFileRoute, redirect } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
    LinkDirection,
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppSection, AppSections } from "../../components/app-section";
import { AppTitle } from "../../components/app-title";
import { Button } from "@mantine/core";
import { GitBranchIcon } from "@phosphor-icons/react";
import {
    SectionError,
    SectionLoading,
    SectionNotice
} from "../../components/app-notice";
import { IconSize } from "../../lib/style-constants";
import { updateUiState, useUiState } from "../../lib/ui-state";
import { UtilityTab } from "../../lib/app-tab";
import { getUiLibraryId } from "../../lib/library";
import { toTargetWorkspace } from "../../lib/onshape-launch";
import { useOnshapeLaunch, useTargetWorkspace } from "../../lib/onshape-params";
import {
    DirectionIcon,
    DirectionInfo,
    DIRECTION_COPY,
    LinkedWorkspaceSection,
    SectionActions,
    useLinkActions
} from "../../features/version-manager/components/linked-workspace-section";
import { VersionManagerZeroState } from "../../features/version-manager/components/version-manager-zero-state";
import { LastRunCallout } from "../../features/version-manager/components/last-run-callout";
import { useWorkspaceLinksQuery } from "../../features/version-manager/queries";
import { useNeedsSignIn } from "../../features/auth/access-level";
import { startSignIn } from "../../features/auth/sign-in";

export const Route = createFileRoute("/app/version-manager")({
    component: VersionManagerPage,
    // Where entry resumes next time, as a library would be.
    onEnter: () => {
        updateUiState({
            tabId: UtilityTab.VERSION_MANAGER,
            // Found, so it stops being pointed out.
            hasOpenedVersionManager: true
        });
    },
    beforeLoad: () => {
        // Nothing to act on: the page picker hides this page without a
        // workspace, so this only catches a url typed or restored by hand.
        if (!toTargetWorkspace(useOnshapeLaunch.getState())) {
            throw redirect({
                to: "/app/library/$libraryId",
                params: { libraryId: getUiLibraryId() },
                replace: true
            });
        }
    }
});

function VersionManagerPage(): ReactNode {
    const workspace = useTargetWorkspace();
    const needsSignIn = useNeedsSignIn();

    if (!workspace) {
        // What renders on the way out, `beforeLoad` having redirected.
        return <SectionLoading title="Loading..." />;
    }
    if (needsSignIn) {
        return (
            <SectionNotice
                icon={<GitBranchIcon size={IconSize.SECTION} />}
                title="Sign in to manage versions"
                description="Pushing and pulling happen in your Onshape documents."
                action={
                    <Button variant="light" onClick={startSignIn}>
                        Sign in
                    </Button>
                }
            />
        );
    }
    return <VersionManager workspace={workspace} />;
}

interface VersionManagerProps {
    workspace: WorkspacePath;
}

/** The two link lists, each owning its own push or pull. */
function VersionManager(props: VersionManagerProps): ReactNode {
    const { workspace } = props;
    const linksQuery = useWorkspaceLinksQuery(workspace);
    const isParentsOpen = useUiState((state) => state.isParentsOpen);
    const isChildrenOpen = useUiState((state) => state.isChildrenOpen);

    if (linksQuery.isPending) {
        return <SectionLoading title="Loading linked workspaces..." />;
    }
    if (linksQuery.isError || !linksQuery.data) {
        return <SectionError title="Failed to load linked workspaces." />;
    }

    const links = linksQuery.data;
    if (links.parents.length === 0 && links.children.length === 0) {
        return (
            <VersionManagerZeroState
                workspace={workspace}
                documentName={links.documentName}
            />
        );
    }

    const opened = [
        ...(isParentsOpen ? [LinkDirection.PARENT] : []),
        ...(isChildrenOpen ? [LinkDirection.CHILD] : [])
    ];

    const handleChange = (values: string[]) => {
        updateUiState({
            isParentsOpen: values.includes(LinkDirection.PARENT),
            isChildrenOpen: values.includes(LinkDirection.CHILD)
        });
    };

    return (
        <>
            <LastRunCallout workspace={workspace} />
            <AppSections opened={opened} onChange={handleChange}>
                <LinkSection
                    workspace={workspace}
                    direction={LinkDirection.PARENT}
                    linked={links.parents}
                    opened={isParentsOpen}
                />
                <LinkSection
                    workspace={workspace}
                    direction={LinkDirection.CHILD}
                    linked={links.children}
                    opened={isChildrenOpen}
                />
            </AppSections>
        </>
    );
}

interface LinkSectionProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
    linked: LinkedWorkspace[];
    /** Which way this section's own chevron points. */
    opened: boolean;
}

/** One direction's section: its links, and the run they share. */
function LinkSection(props: LinkSectionProps): ReactNode {
    const { workspace, direction, linked, opened } = props;
    const actions = useLinkActions(workspace, direction);
    const copy = DIRECTION_COPY[direction];

    return (
        <AppSection
            value={direction}
            name={copy.title}
            title={
                <AppTitle
                    title={copy.title}
                    rightSection={<DirectionInfo direction={direction} />}
                />
            }
            icon={<DirectionIcon direction={direction} />}
            actions={
                <SectionActions
                    direction={direction}
                    linked={linked}
                    actions={actions}
                />
            }
            opened={opened}
            onToggle={() =>
                updateUiState(
                    direction === LinkDirection.PARENT
                        ? { isParentsOpen: !opened }
                        : { isChildrenOpen: !opened }
                )
            }
        >
            <LinkedWorkspaceSection
                workspace={workspace}
                direction={direction}
                linked={linked}
                actions={actions}
            />
        </AppSection>
    );
}
