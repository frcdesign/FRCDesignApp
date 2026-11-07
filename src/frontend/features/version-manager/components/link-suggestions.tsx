import { Button, Card, Menu, Stack, Text, Tooltip } from "@mantine/core";
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
import { AppIcon } from "../../../components/app-icon";
import { MenuSection } from "../../../components/app-menu";
import { CardTitle, ItemRow, ItemTable } from "../../../components/item-row";
import { CardThumbnail } from "../../thumbnails/components/thumbnail";
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

interface SuggestedLinksCardProps {
    workspace: WorkspacePath;
    documentName: string;
    suggestions: SuggestedLink[];
}

/** The welcome page's suggestions, in place of the card for linking by url. */
export function SuggestedLinksCard(props: SuggestedLinksCardProps): ReactNode {
    const { workspace, documentName, suggestions } = props;
    const linkParents = useLinkParentsMutation(workspace);

    return (
        <Card ta="left">
            <Stack gap="sm">
                <Stack gap={2}>
                    <Text fw={FontWeight.SEMI_BOLD}>
                        {m.versionManagerSuggestionsTitle()}
                    </Text>
                    <Text size="sm" c={StatusColor.DIMMED}>
                        {m.versionManagerSuggestionsDescription({
                            documentName
                        })}
                    </Text>
                </Stack>
                <ItemTable>
                    <SuggestedLinkRows
                        workspace={workspace}
                        suggestions={suggestions}
                    />
                </ItemTable>
                <Button
                    variant="filled"
                    leftSection={<LinkIcon size={IconSize.SMALL} />}
                    loading={linkParents.isPending}
                    onClick={() =>
                        linkParents.mutate(
                            suggestions.map((each) => each.workspace)
                        )
                    }
                >
                    {m.versionManagerSuggestionsLinkAll()}
                </Button>
            </Stack>
        </Card>
    );
}

interface LinkSuggestionsMenuSectionProps {
    workspace: WorkspacePath;
    suggestions: SuggestedLink[];
}

/** **Link all** in the parents' header menu, while there is anything to link. */
export function LinkSuggestionsMenuSection(
    props: LinkSuggestionsMenuSectionProps
): ReactNode {
    const { workspace, suggestions } = props;
    const linkParents = useLinkParentsMutation(workspace);
    if (suggestions.length === 0) {
        return null;
    }

    return (
        <MenuSection label={m.versionManagerSuggestionsMenuSection()}>
            <Menu.Item
                leftSection={<LinkIcon size={IconSize.MEDIUM} />}
                disabled={linkParents.isPending}
                onClick={() =>
                    linkParents.mutate(
                        suggestions.map((each) => each.workspace)
                    )
                }
            >
                {m.versionManagerSuggestionsLinkAll()}
            </Menu.Item>
        </MenuSection>
    );
}

interface SuggestedLinkRowsProps {
    workspace: WorkspacePath;
    suggestions: SuggestedLink[];
}

/** One row per suggestion, inside the caller's `ItemTable`. */
export function SuggestedLinkRows(props: SuggestedLinkRowsProps): ReactNode {
    const { workspace, suggestions } = props;
    const addLink = useAddLinkMutation(workspace);
    const linking = addLink.isPending ? addLink.variables.linked : undefined;

    return suggestions.map((each) => (
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
    ));
}

interface SuggestedLinkRowProps {
    suggestion: SuggestedLink;
    isLinking: boolean;
    onLink: () => void;
}

/** Dimmed and marked with a bulb, so it reads apart from the links around it. */
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
                    disabled
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
                    badge={
                        <Tooltip label={m.versionManagerSuggestionsTooltip()}>
                            <AppIcon
                                icon={LightbulbIcon}
                                className={styles.noShrink}
                                color={StatusColor.DIMMED}
                            />
                        </Tooltip>
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
