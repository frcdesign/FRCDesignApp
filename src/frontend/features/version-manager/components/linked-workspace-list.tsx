import { Group, Menu, Stack, Text } from "@mantine/core";
import {
    ArrowSquareOutIcon,
    LinkBreakIcon,
    WarningIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    type LinkDirection,
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { ItemRow, ItemTable } from "../../../components/item-row";
import { MenuSection } from "../../../components/app-menu";
import { Section } from "../../../components/section";
import { SectionNotice } from "../../../components/app-zero-state";
import { TruncatedText } from "../../../components/truncated-text";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { makeUrl, openUrlInNewTab } from "../../../lib/url";
import { useRemoveLinkMutation } from "../queries";
import { AddLinkInput } from "./add-link-input";

interface LinkedWorkspaceListProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
    title: string;
    /** What linking in this direction does, shown above the list. */
    description: string;
    placeholder: string;
    linked: LinkedWorkspace[];
    emptyMessage: string;
}

/** One direction's links, with the input that adds another. */
export function LinkedWorkspaceList(
    props: LinkedWorkspaceListProps
): ReactNode {
    const {
        workspace,
        direction,
        title,
        description,
        placeholder,
        linked,
        emptyMessage
    } = props;
    const removeLink = useRemoveLinkMutation(workspace);

    return (
        <Section title={title}>
            <Text size="sm" c={StatusColor.DIMMED}>
                {description}
            </Text>
            <AddLinkInput
                workspace={workspace}
                direction={direction}
                placeholder={placeholder}
            />
            {linked.length === 0 ? (
                <SectionNotice
                    title={emptyMessage}
                    description={null}
                    icon={
                        <LinkBreakIcon
                            size={IconSize.PAGE}
                            color={StatusColor.DIMMED}
                        />
                    }
                />
            ) : (
                <ItemTable>
                    {linked.map((each) => (
                        <LinkedWorkspaceRow
                            key={each.linkId}
                            linked={each}
                            onRemove={() => removeLink.mutate(each.linkId)}
                        />
                    ))}
                </ItemTable>
            )}
        </Section>
    );
}

interface LinkedWorkspaceRowProps {
    linked: LinkedWorkspace;
    onRemove: () => void;
}

function LinkedWorkspaceRow(props: LinkedWorkspaceRowProps): ReactNode {
    const { linked, onRemove } = props;
    const url = makeUrl(linked.workspace);

    const menuItems = (
        <MenuSection label="Link">
            {linked.isOpenable && (
                <Menu.Item
                    leftSection={<ArrowSquareOutIcon size={IconSize.MEDIUM} />}
                    onClick={() => openUrlInNewTab(url)}
                >
                    Open in Onshape
                </Menu.Item>
            )}
            <Menu.Item
                color={StatusColor.ERROR}
                leftSection={<LinkBreakIcon size={IconSize.MEDIUM} />}
                onClick={onRemove}
            >
                Remove link
            </Menu.Item>
        </MenuSection>
    );

    return (
        <ItemRow
            left={<LinkedWorkspaceTitle linked={linked} />}
            menuItems={menuItems}
            onClick={linked.isOpenable ? () => openUrlInNewTab(url) : undefined}
        />
    );
}

/**
 * The document and workspace a link points at. A link the caller cannot read
 * shows that it exists and nothing else: what it points at is not theirs to
 * know, and the row is still theirs to remove.
 */
function LinkedWorkspaceTitle(props: { linked: LinkedWorkspace }): ReactNode {
    const { linked } = props;

    if (!linked.isOpenable) {
        return (
            <Group gap="sm" wrap="nowrap" flex={1} miw={0}>
                <WarningIcon
                    size={IconSize.MEDIUM}
                    color={StatusColor.WARNING}
                />
                <Text size="sm" c={StatusColor.DIMMED}>
                    A document you cannot open
                </Text>
            </Group>
        );
    }

    // Readable but unnamed: the document answered, and had nothing to say.
    const documentName = linked.documentName ?? "Untitled document";

    return (
        <Stack gap={0} miw={0} flex={1}>
            <TruncatedText hoverText={documentName} size="sm">
                {documentName}
            </TruncatedText>
            {linked.workspaceName && (
                <Text size="xs" c={StatusColor.DIMMED} truncate>
                    {linked.workspaceName}
                </Text>
            )}
        </Stack>
    );
}
