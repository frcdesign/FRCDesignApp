import { createFileRoute, redirect } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
    LinkDirection,
    type LinkedWorkspace,
    type WorkspaceLinksData,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppSection, AppSections } from "../../components/app-section";
import { AppTitle } from "../../components/app-title";
import { SectionLoading, SectionNotice } from "../../components/app-zero-state";
import { getUiState, updateUiState, useGetUiState } from "../../lib/ui-state";
import { toTargetWorkspace } from "../../lib/onshape-launch";
import { useTargetWorkspace } from "../../lib/onshape-params";
import {
    DirectionIcon,
    DirectionInfo,
    DIRECTION_COPY,
    LinkedWorkspaceSection,
    SectionActions,
    useLinkActions
} from "../../features/version-manager/components/linked-workspace-section";
import { VersionManagerZeroState } from "../../features/version-manager/components/version-manager-zero-state";
import { useVersionJobToasts } from "../../features/version-manager/job-toasts";
import { useWorkspaceLinksQuery } from "../../features/version-manager/queries";
import { useIsSignedIn } from "../../features/auth/access-level";

export const Route = createFileRoute("/app/version-manager")({
    component: VersionManagerPage,
    // Where entry resumes next time, as a library would be.
    onEnter: () => {
        updateUiState({ isVersionManagerOpen: true });
    },
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
    // Mounted once for the page: a run belongs to the workspace, not to either
    // section, so it is reported in one place however it was started.
    useVersionJobToasts(workspace);

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
    const uiState = useGetUiState();

    if (linksQuery.isPending) {
        return <SectionLoading title="Loading linked workspaces..." />;
    }
    if (linksQuery.isError || !linksQuery.data) {
        return <SectionNotice title="Failed to load linked workspaces." />;
    }

    const links: WorkspaceLinksData = linksQuery.data;
    // Nothing linked in either direction: the sections would both be empty, and
    // an empty section says neither what this page is for nor what to do next.
    if (links.parents.length === 0 && links.children.length === 0) {
        return (
            <VersionManagerZeroState
                workspace={workspace}
                documentName={links.documentName}
            />
        );
    }

    const opened = [
        ...(uiState.isParentsOpen ? [LinkDirection.PARENT] : []),
        ...(uiState.isChildrenOpen ? [LinkDirection.CHILD] : [])
    ];

    const handleChange = (values: string[]) => {
        updateUiState({
            isParentsOpen: values.includes(LinkDirection.PARENT),
            isChildrenOpen: values.includes(LinkDirection.CHILD)
        });
    };

    return (
        <AppSections opened={opened} onChange={handleChange}>
            <LinkSection
                workspace={workspace}
                direction={LinkDirection.PARENT}
                linked={links.parents}
                opened={uiState.isParentsOpen}
            />
            <LinkSection
                workspace={workspace}
                direction={LinkDirection.CHILD}
                linked={links.children}
                opened={uiState.isChildrenOpen}
            />
        </AppSections>
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
