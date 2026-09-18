import { createFileRoute, redirect } from "@tanstack/react-router";
import { Accordion, ActionIcon, Group } from "@mantine/core";
import { CaretDownIcon } from "@phosphor-icons/react";
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
    IconSize,
    NO_SHRINK,
    SECTION_HEADER_HEIGHT,
    StatusColor,
    TITLE_ICON_NUDGE
} from "../../lib/style-constants";
import { getUiState, updateUiState, useGetUiState } from "../../lib/ui-state";
import { toTargetWorkspace } from "../../lib/onshape-launch";
import { useTargetWorkspace } from "../../lib/onshape-params";
import {
    DirectionIcon,
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
        return <VersionManagerZeroState workspace={workspace} />;
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
        <Accordion
            multiple
            variant="unstyled"
            value={opened}
            onChange={handleChange}
            styles={{
                control: {
                    minHeight: SECTION_HEADER_HEIGHT,
                    // Mantine brightens a control to pure white or black; a
                    // section header is a title, so it reads in the text color.
                    color: "var(--mantine-color-text)"
                },
                label: { paddingBlock: 0 },
                content: { padding: 0, borderBottom: BORDER },
                icon: TITLE_ICON_NUDGE,
                // The header row ends with a chevron of its own, past the
                // buttons; Mantine's sits against the label, which is not the
                // far right of anything.
                chevron: { display: "none" }
            }}
        >
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
        </Accordion>
    );
}

interface LinkSectionProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
    linked: LinkedWorkspace[];
    /** Which way this section's own chevron points. */
    opened: boolean;
}

/**
 * One accordion section. Its buttons sit beside the control rather than inside
 * it — a button cannot be nested in a button — and the chevron comes after
 * them, at the end of the row.
 */
function LinkSection(props: LinkSectionProps): ReactNode {
    const { workspace, direction, linked, opened } = props;
    const actions = useLinkActions(workspace, direction, linked);

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
                >
                    <AppTitle title={DIRECTION_COPY[direction].title} />
                </Accordion.Control>
                <SectionActions
                    direction={direction}
                    linked={linked}
                    actions={actions}
                />
                <SectionChevron direction={direction} opened={opened} />
            </Group>
            <Accordion.Panel>
                <LinkedWorkspaceSection
                    workspace={workspace}
                    direction={direction}
                    linked={linked}
                    actions={actions}
                />
            </Accordion.Panel>
        </Accordion.Item>
    );
}

interface SectionChevronProps {
    direction: LinkDirection;
    opened: boolean;
}

/**
 * The section's own chevron, at the end of the header row. Mantine's is hidden
 * and this stands in for it, so it lands past the buttons rather than against
 * the title.
 */
function SectionChevron(props: SectionChevronProps): ReactNode {
    const { direction, opened } = props;
    const isParents = direction === LinkDirection.PARENT;

    return (
        <ActionIcon
            variant="subtle"
            color={StatusColor.NEUTRAL}
            aria-label={`${opened ? "Collapse" : "Expand"} ${DIRECTION_COPY[direction].title}`}
            style={NO_SHRINK}
            onClick={() =>
                updateUiState(
                    isParents
                        ? { isParentsOpen: !opened }
                        : { isChildrenOpen: !opened }
                )
            }
        >
            <CaretDownIcon
                size={IconSize.MEDIUM}
                style={{
                    transform: opened ? "rotate(180deg)" : undefined,
                    transition: "transform 200ms ease"
                }}
            />
        </ActionIcon>
    );
}
