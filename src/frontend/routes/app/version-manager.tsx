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
import { SectionLoading, SectionNotice } from "../../components/app-notice";
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
import {
    LAST_RUN_SECTION,
    LastRunSection
} from "../../features/version-manager/components/last-run-section";
import { useVersionJobToasts } from "../../features/version-manager/job-toasts";
import { useWorkspaceLinksQuery } from "../../features/version-manager/queries";
import { useIsSignedIn } from "../../features/auth/access-level";

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
    const isParentsOpen = useUiState((state) => state.isParentsOpen);
    const isChildrenOpen = useUiState((state) => state.isChildrenOpen);
    const isLastRunOpen = useUiState((state) => state.isLastRunOpen);

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
        ...(isLastRunOpen ? [LAST_RUN_SECTION] : []),
        ...(isParentsOpen ? [LinkDirection.PARENT] : []),
        ...(isChildrenOpen ? [LinkDirection.CHILD] : [])
    ];

    const handleChange = (values: string[]) => {
        updateUiState({
            isLastRunOpen: values.includes(LAST_RUN_SECTION),
            isParentsOpen: values.includes(LinkDirection.PARENT),
            isChildrenOpen: values.includes(LinkDirection.CHILD)
        });
    };

    return (
        <AppSections opened={opened} onChange={handleChange}>
            <LastRunSection workspace={workspace} opened={isLastRunOpen} />
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
