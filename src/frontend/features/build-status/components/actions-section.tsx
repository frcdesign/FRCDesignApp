import { ActionIcon, Button, Group, Stack, Tooltip } from "@mantine/core";
import {
    ArrowsClockwiseIcon,
    EyeIcon,
    EyeSlashIcon,
    ImageIcon,
    TrashIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type {
    GroupBuildStatus,
    InsertableBuildStatus
} from "@backend/features/build-checker/contract";
import { HoverBubbleRow } from "../../../components/app-hover-bubble";
import { openDeleteConfirm } from "../../../components/alerts";
import { getMoveOptions } from "../../../lib/move-order";
import { useIsHome } from "../../../lib/library";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import {
    useDeleteGroupMutation,
    useLibraryQuery,
    useReloadThumbnailMutation,
    useSetGroupOrderMutation
} from "../../library/queries";
import {
    useSetVisibilityMutation,
    useUpdateReferencesMutation
} from "../queries";

interface InsertableActionsProps {
    insertableId: string;
    status: InsertableBuildStatus;
}

/** What an editor can do to one element, beyond its settings. */
export function InsertableActions(props: InsertableActionsProps): ReactNode {
    const { insertableId, status } = props;
    const { documentId, elementId } = status.elementPath;
    return (
        <Group gap={6} wrap="wrap">
            <ReloadThumbnailButton target={{ insertableId }} />
            <UpdateReferencesButton
                documentId={documentId}
                elementId={elementId}
            />
        </Group>
    );
}

interface GroupActionsProps {
    groupId: string;
    name: string;
    status: GroupBuildStatus;
}

/** What an editor can do to a group; ordering and deleting only from the library's own list. */
export function GroupActions(props: GroupActionsProps): ReactNode {
    const { groupId, name, status } = props;
    const isHome = useIsHome();
    const libraryQuery = useLibraryQuery();
    const documentId = libraryQuery.data?.groups[groupId]?.documentId;

    return (
        <Stack gap="xs">
            <Group gap={6} wrap="wrap">
                <ReloadThumbnailButton target={{ groupId }} />
                {documentId && (
                    <UpdateReferencesButton documentId={documentId} />
                )}
            </Group>
            <Group gap={6} wrap="wrap">
                <VisibilityButton
                    insertableIds={status.insertableOrder}
                    isVisible
                />
                <VisibilityButton
                    insertableIds={status.insertableOrder}
                    isVisible={false}
                />
            </Group>
            {isHome && (
                <>
                    <GroupOrderRow
                        groupId={groupId}
                        groupOrder={libraryQuery.data?.groupOrder ?? []}
                    />
                    <DeleteGroupButton groupId={groupId} name={name} />
                </>
            )}
        </Stack>
    );
}

interface ReloadThumbnailButtonProps {
    /** Whose thumbnail: a group's own, or one element's. */
    target: { groupId: string } | { insertableId: string };
}

/** A load doesn't wait for thumbnails, so this refetches one without reloading the document. */
function ReloadThumbnailButton(props: ReloadThumbnailButtonProps): ReactNode {
    const mutation = useReloadThumbnailMutation(props.target);
    return (
        <Button
            size="compact-sm"
            leftSection={<ImageIcon size={IconSize.SMALL} />}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
        >
            {m.adminCardReloadThumbnail()}
        </Button>
    );
}

interface UpdateReferencesButtonProps {
    documentId: string;
    /** One tab's references; omitted, the whole document's. */
    elementId?: string;
}

function UpdateReferencesButton(props: UpdateReferencesButtonProps): ReactNode {
    const { documentId, elementId } = props;
    const mutation = useUpdateReferencesMutation(documentId, elementId);
    return (
        <Tooltip
            label={
                elementId
                    ? m.adminCardUpdateReferencesTabHelp()
                    : m.adminCardUpdateReferencesDocumentHelp()
            }
        >
            <Button
                size="compact-sm"
                leftSection={<ArrowsClockwiseIcon size={IconSize.SMALL} />}
                loading={mutation.isPending}
                onClick={() => mutation.mutate()}
            >
                {m.adminCardUpdateReferences()}
            </Button>
        </Tooltip>
    );
}

interface VisibilityButtonProps {
    insertableIds: string[];
    isVisible: boolean;
}

function VisibilityButton(props: VisibilityButtonProps): ReactNode {
    const { insertableIds, isVisible } = props;
    const mutation = useSetVisibilityMutation(insertableIds, isVisible);
    const Icon = isVisible ? EyeIcon : EyeSlashIcon;
    return (
        <Button
            size="compact-sm"
            leftSection={<Icon size={IconSize.SMALL} />}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
        >
            {isVisible ? m.adminCardShowAll() : m.adminCardHideAll()}
        </Button>
    );
}

interface GroupOrderRowProps {
    groupId: string;
    groupOrder: string[];
}

function GroupOrderRow(props: GroupOrderRowProps): ReactNode {
    const { groupId, groupOrder } = props;
    const mutation = useSetGroupOrderMutation();
    const options = getMoveOptions(groupId, groupOrder);
    if (options.length === 0) {
        return null;
    }
    return (
        <HoverBubbleRow label={m.adminCardOrder()}>
            <Group gap={4}>
                {options.map((option) => (
                    <Tooltip key={option.label} label={option.label}>
                        <ActionIcon
                            onClick={() => mutation.mutate(option.order)}
                        >
                            <option.icon size={IconSize.SMALL} />
                        </ActionIcon>
                    </Tooltip>
                ))}
            </Group>
        </HoverBubbleRow>
    );
}

interface DeleteGroupButtonProps {
    groupId: string;
    name: string;
}

function DeleteGroupButton(props: DeleteGroupButtonProps): ReactNode {
    const { groupId, name } = props;
    const mutation = useDeleteGroupMutation(groupId);

    const confirmDelete = () =>
        openDeleteConfirm({
            title: m.adminCardDeleteGroup(),
            text: m.adminCardDeleteGroupConfirm({ name }),
            confirmLabel: m.adminCardDeleteGroup(),
            onConfirm: () => mutation.mutate()
        });

    return (
        <Button
            color={StatusColor.ERROR}
            size="compact-sm"
            mr="auto"
            leftSection={<TrashIcon size={IconSize.SMALL} />}
            loading={mutation.isPending}
            onClick={confirmDelete}
        >
            {m.adminCardDeleteGroup()}
        </Button>
    );
}
