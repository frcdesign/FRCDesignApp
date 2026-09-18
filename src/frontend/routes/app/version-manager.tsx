import { createFileRoute, redirect } from "@tanstack/react-router";
import { Accordion, Group } from "@mantine/core";
import { type ReactNode } from "react";
import {
    LinkDirection,
    type LinkedWorkspace,
    type WorkspaceLinksData,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppTitle } from "../../components/app-title";
import { SectionLoading, SectionNotice } from "../../components/app-zero-state";
import {
    BORDER,
    SECTION_HEADER_HEIGHT,
    TITLE_ICON_NUDGE
} from "../../lib/style-constants";
import { getUiState, updateUiState, useGetUiState } from "../../lib/ui-state";
import { toTargetWorkspace } from "../../lib/onshape-launch";
import { useTargetWorkspace } from "../../lib/onshape-params";
import {
    DirectionIcon,
    DIRECTION_COPY,
    LinkedWorkspaceSection,
    QuickActionButton,
    SectionMenu,
    useLinkActions
} from "../../features/version-manager/components/linked-workspace-section";
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
    const uiState = useGetUiState();

    if (linksQuery.isPending) {
        return <SectionLoading title="Loading linked workspaces..." />;
    }
    if (linksQuery.isError || !linksQuery.data) {
        return <SectionNotice title="Failed to load linked workspaces." />;
    }

    const links: WorkspaceLinksData = linksQuery.data;
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
        <>
            <VersionJobStatus workspace={workspace} />
            <Accordion
                multiple
                variant="unstyled"
                value={opened}
                onChange={handleChange}
                styles={{
                    // On the control, so a collapsed section still divides from
                    // the next one; content closes off an open one.
                    control: {
                        borderBottom: BORDER,
                        minHeight: SECTION_HEADER_HEIGHT,
                        color: "var(--mantine-color-text)"
                    },
                    label: { paddingBlock: 0 },
                    content: { padding: 0, borderBottom: BORDER },
                    icon: TITLE_ICON_NUDGE
                }}
            >
                <LinkSection
                    workspace={workspace}
                    direction={LinkDirection.PARENT}
                    linked={links.parents}
                />
                <LinkSection
                    workspace={workspace}
                    direction={LinkDirection.CHILD}
                    linked={links.children}
                />
            </Accordion>
        </>
    );
}

interface LinkSectionProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
    linked: LinkedWorkspace[];
}

/**
 * One accordion section. Its quick button and menu sit beside the control
 * rather than inside it — a button cannot be nested in a button, and the action
 * should be reachable without opening the section.
 */
function LinkSection(props: LinkSectionProps): ReactNode {
    const { workspace, direction, linked } = props;
    const actions = useLinkActions(workspace, direction);

    return (
        <Accordion.Item value={direction}>
            <Group
                gap="xs"
                wrap="nowrap"
                pr="sm"
                style={{ borderBottom: BORDER }}
            >
                <Accordion.Control
                    className="interactive"
                    // Shrinkable, so the buttons beside it keep their width.
                    miw={0}
                    icon={<DirectionIcon direction={direction} />}
                    // The row below owns the divider, so the control's own
                    // would draw a second line under it.
                    styles={{ control: { borderBottom: "none" } }}
                >
                    <AppTitle title={DIRECTION_COPY[direction].title} />
                </Accordion.Control>
                <QuickActionButton
                    direction={direction}
                    disabled={actions.isRunning || linked.length === 0}
                    onClick={actions.quickAll}
                />
                <SectionMenu
                    direction={direction}
                    linked={linked}
                    actions={actions}
                />
            </Group>
            <Accordion.Panel>
                <LinkedWorkspaceSection
                    workspace={workspace}
                    direction={direction}
                    linked={linked}
                />
            </Accordion.Panel>
        </Accordion.Item>
    );
}
