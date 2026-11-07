import { Button, Card, Menu, Stack, Text } from "@mantine/core";
import {
    ArrowSquareOutIcon,
    LightbulbIcon,
    LinkIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    isSameWorkspace,
    LinkDirection,
    workspaceThumbnailUrl,
    type SuggestedLink,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { ThumbnailSize } from "@backend/features/thumbnails/contract";
import { AppSection } from "../../../components/app-section";
import { AppTitle } from "../../../components/app-title";
import { InfoTooltip } from "../../../components/info-tooltip";
import { CardTitle, ItemRow, ItemTable } from "../../../components/item-row";
import { CardThumbnail } from "../../thumbnails/components/thumbnail";
import { SectionId } from "../../../lib/ui-state";
import {
    FontWeight,
    IconSize,
    StatusColor
} from "../../../lib/style-constants";
import { makeUrl, openUrlInNewTab } from "../../../lib/url";
import { useOnshapeOrigin } from "../../../lib/onshape-params";
import styles from "../../../lib/styles.module.css";
import { m } from "../../../paraglide/messages";
import { documentLabel } from "../document-label";
import { useAddLinkMutation, useLinkParentsMutation } from "../queries";

interface SuggestedParentsSectionProps {
    workspace: WorkspacePath;
    suggestions: SuggestedLink[];
}

/** The page's section of suggestions, below the links themselves. */
export function SuggestedParentsSection(
    props: SuggestedParentsSectionProps
): ReactNode {
    const { workspace, suggestions } = props;
    const title = m.versionManagerSuggestionsTitle();

    return (
        <AppSection
            value={SectionId.SUGGESTED_PARENTS}
            name={title}
            title={
                <AppTitle
                    title={title}
                    rightSection={
                        <InfoTooltip
                            label={m.versionManagerSuggestionsInfo()}
                            className={`${styles.noShrink} ${styles.titleIcon}`}
                        />
                    }
                />
            }
            icon={<LightbulbIcon size={IconSize.MEDIUM} />}
            actions={
                <LinkAllButton
                    workspace={workspace}
                    suggestions={suggestions}
                    compact
                />
            }
        >
            <SuggestedLinkList
                workspace={workspace}
                suggestions={suggestions}
            />
        </AppSection>
    );
}

interface SuggestedLinksCardProps {
    workspace: WorkspacePath;
    documentName: string;
    suggestions: SuggestedLink[];
}

/** The welcome page's card of suggestions, above the field for linking one by hand. */
export function SuggestedLinksCard(props: SuggestedLinksCardProps): ReactNode {
    const { workspace, documentName, suggestions } = props;

    return (
        <Card ta="left">
            <Stack gap="sm">
                <Stack gap={2}>
                    <Text fw={FontWeight.SEMI_BOLD}>
                        {m.versionManagerSuggestionsFound({
                            count: suggestions.length
                        })}
                    </Text>
                    <Text size="sm" c={StatusColor.DIMMED}>
                        {m.versionManagerSuggestionsFoundDescription({
                            documentName
                        })}
                    </Text>
                </Stack>
                <SuggestedLinkList
                    workspace={workspace}
                    suggestions={suggestions}
                />
                <LinkAllButton
                    workspace={workspace}
                    suggestions={suggestions}
                />
            </Stack>
        </Card>
    );
}

interface LinkAllButtonProps {
    workspace: WorkspacePath;
    suggestions: SuggestedLink[];
    /** In a section's header, rather than under a card's list. */
    compact?: boolean;
}

function LinkAllButton(props: LinkAllButtonProps): ReactNode {
    const { workspace, suggestions, compact = false } = props;
    const linkParents = useLinkParentsMutation(workspace);

    return (
        <Button
            size={compact ? "compact-sm" : undefined}
            variant={compact ? "subtle" : "filled"}
            className={styles.noShrink}
            leftSection={<LinkIcon size={IconSize.SMALL} />}
            loading={linkParents.isPending}
            onClick={() =>
                linkParents.mutate(suggestions.map((each) => each.workspace))
            }
        >
            {compact
                ? m.versionManagerSuggestionsLinkAll()
                : m.versionManagerSuggestionsLinkAllParents()}
        </Button>
    );
}

interface SuggestedLinkListProps {
    workspace: WorkspacePath;
    suggestions: SuggestedLink[];
}

function SuggestedLinkList(props: SuggestedLinkListProps): ReactNode {
    const { workspace, suggestions } = props;
    const addLink = useAddLinkMutation(workspace);
    const linking = addLink.isPending ? addLink.variables.linked : undefined;

    return (
        <ItemTable>
            {suggestions.map((each) => (
                <SuggestedLinkRow
                    key={each.workspace.documentId}
                    suggestion={each}
                    isLinking={
                        linking !== undefined &&
                        isSameWorkspace(linking, each.workspace)
                    }
                    onLink={() =>
                        addLink.mutate({
                            linked: each.workspace,
                            direction: LinkDirection.PARENT
                        })
                    }
                />
            ))}
        </ItemTable>
    );
}

interface SuggestedLinkRowProps {
    suggestion: SuggestedLink;
    isLinking: boolean;
    onLink: () => void;
}

function SuggestedLinkRow(props: SuggestedLinkRowProps): ReactNode {
    const { suggestion, isLinking, onLink } = props;
    const origin = useOnshapeOrigin();
    const url = makeUrl(origin, suggestion.workspace);

    const menuItems = (
        <>
            <Menu.Item
                leftSection={<LinkIcon size={IconSize.MEDIUM} />}
                onClick={onLink}
            >
                {m.versionManagerSuggestionsLink()}
            </Menu.Item>
            <Menu.Item
                color={StatusColor.INFO}
                leftSection={<ArrowSquareOutIcon size={IconSize.MEDIUM} />}
                onClick={() => openUrlInNewTab(url)}
            >
                {m.versionManagerSuggestionsOpen()}
            </Menu.Item>
        </>
    );

    return (
        <ItemRow
            left={
                <CardTitle
                    title={documentLabel(suggestion.documentName)}
                    thumbnail={
                        <CardThumbnail
                            smallThumbnailUrl={workspaceThumbnailUrl(
                                suggestion.workspace,
                                ThumbnailSize.SMALL
                            )}
                            largeThumbnailUrl={workspaceThumbnailUrl(
                                suggestion.workspace,
                                ThumbnailSize.LARGE
                            )}
                        />
                    }
                    subtitle={
                        suggestion.workspaceName && (
                            <Text size="xs" c={StatusColor.DIMMED} truncate>
                                {suggestion.workspaceName}
                            </Text>
                        )
                    }
                />
            }
            menuItems={menuItems}
            moreButton={false}
            rightSection={
                <Button
                    size="compact-sm"
                    variant="outline"
                    leftSection={<LinkIcon size={IconSize.SMALL} />}
                    loading={isLinking}
                    onClick={onLink}
                >
                    {m.versionManagerSuggestionsLink()}
                </Button>
            }
        />
    );
}
