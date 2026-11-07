import { FeedbackTopic } from "@backend/features/feedback/contract";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import {
    LinkDirection,
    type LinkedWorkspace,
    type SuggestedLink,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppSection, AppSections } from "../../components/app-section";
import { AppTitle } from "../../components/app-title";
import { Button } from "@mantine/core";
import { GitBranchIcon } from "@phosphor-icons/react";
import {
    PageError,
    PageLoading,
    PageNotice
} from "../../components/app-notice";
import { IconSize } from "../../lib/style-constants";
import {
    SectionId,
    setSectionOpened,
    updateUiState,
    useSectionOpened
} from "../../lib/ui-state";
import { UtilityTab } from "../../lib/app-tab";
import { getUiLibraryId } from "../../lib/library";
import { toTargetWorkspace } from "../../lib/onshape-launch";
import { useOnshapeLaunch, useTargetWorkspace } from "../../lib/onshape-params";
import {
    DirectionIcon,
    DirectionInfo,
    LinkedWorkspaceSection,
    SectionActions
} from "../../features/version-manager/components/linked-workspace-section";
import { DIRECTION_COPY } from "../../features/version-manager/direction-copy";
import { useLinkActions } from "../../features/version-manager/link-actions";
import { VersionManagerZeroState } from "../../features/version-manager/components/version-manager-zero-state";
import { LastRunCallout } from "../../features/version-manager/components/last-run-callout";
import {
    useLinkSuggestionsQuery,
    useWorkspaceLinksQuery
} from "../../features/version-manager/queries";
import { useNeedsSignIn } from "../../features/auth/access-level";
import { startSignIn } from "../../features/auth/sign-in";
import { useMarkHintSeen } from "../../features/hints/queries";
import { Hint } from "@backend/features/hints/contract";
import { m } from "../../paraglide/messages";

export const Route = createFileRoute("/app/version-manager")({
    component: VersionManagerPage,
    // Where entry resumes next time, as a library would be.
    onEnter: () => {
        updateUiState({ tabId: UtilityTab.VERSION_MANAGER });
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
    const markOpened = useMarkHintSeen(Hint.OPENED_VERSION_MANAGER);

    useEffect(markOpened, [markOpened]);

    if (!workspace) {
        // What renders on the way out, `beforeLoad` having redirected.
        return <PageLoading title={m.versionManagerLoading()} />;
    }
    if (needsSignIn) {
        return (
            <PageNotice
                icon={<GitBranchIcon size={IconSize.SECTION} />}
                title={m.versionManagerSignInTitle()}
                description={m.versionManagerSignInDescription()}
                action={
                    <Button onClick={startSignIn}>
                        {m.versionManagerSignIn()}
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
    const suggestionsQuery = useLinkSuggestionsQuery(workspace);
    const isParentsOpen = useSectionOpened(SectionId.PARENTS);
    const isChildrenOpen = useSectionOpened(SectionId.CHILDREN);

    if (linksQuery.isPending) {
        return <PageLoading title={m.versionManagerLinksLoading()} />;
    }
    if (linksQuery.isError || !linksQuery.data) {
        return (
            <PageError
                title={m.versionManagerLinksFailed()}
                error={linksQuery.error}
                topic={FeedbackTopic.VERSION_MANAGER}
            />
        );
    }

    const links = linksQuery.data;
    // A failed read is only missing suggestions; the links still work.
    const suggestions = suggestionsQuery.data?.suggestions ?? [];
    if (links.parents.length === 0 && links.children.length === 0) {
        return (
            <VersionManagerZeroState
                workspace={workspace}
                documentName={links.documentName}
                suggestions={suggestions}
            />
        );
    }

    const opened = [
        ...(isParentsOpen ? [LinkDirection.PARENT] : []),
        ...(isChildrenOpen ? [LinkDirection.CHILD] : [])
    ];

    const handleChange = (values: string[]) => {
        setSectionOpened(
            SectionId.PARENTS,
            values.includes(LinkDirection.PARENT)
        );
        setSectionOpened(
            SectionId.CHILDREN,
            values.includes(LinkDirection.CHILD)
        );
    };

    return (
        <>
            <LastRunCallout workspace={workspace} />
            <AppSections opened={opened} onChange={handleChange}>
                <LinkSection
                    workspace={workspace}
                    direction={LinkDirection.PARENT}
                    linked={links.parents}
                    suggestions={suggestions}
                />
                <LinkSection
                    workspace={workspace}
                    direction={LinkDirection.CHILD}
                    linked={links.children}
                />
            </AppSections>
        </>
    );
}

interface LinkSectionProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
    linked: LinkedWorkspace[];
    /** Parents only: documents referenced and not yet linked. */
    suggestions?: SuggestedLink[];
}

/** One direction's section: its links, and the run they share. */
function LinkSection(props: LinkSectionProps): ReactNode {
    const { workspace, direction, linked, suggestions = [] } = props;
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
                    workspace={workspace}
                    direction={direction}
                    linked={linked}
                    suggestions={suggestions}
                    actions={actions}
                />
            }
        >
            <LinkedWorkspaceSection
                workspace={workspace}
                direction={direction}
                linked={linked}
                suggestions={suggestions}
                actions={actions}
            />
        </AppSection>
    );
}
