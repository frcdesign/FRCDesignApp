import { Menu, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import {
    ArrowRightIcon,
    EyeIcon,
    EyeSlashIcon,
    TrashIcon,
    WarningIcon
} from "@phosphor-icons/react";
import { AppIcon } from "../../../components/app-icon";
import { AppTitle } from "../../../components/app-title";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import { GroupOut } from "@backend/features/library/contract";
import { ChangeOrderItems } from "../../../components/change-order";
import { AdminOptionsSubmenu } from "../../../components/app-menu";
import { ReloadThumbnailMenuItem } from "../../../components/reload-thumbnail-item";
import { CardTitle, ItemRow } from "../../../components/item-row";
import { OpenDocumentItems } from "../../../components/open-document-items";
import { AddGroupItem } from "./add-group-menu";
import { CardThumbnail } from "../../thumbnails/components/thumbnail";
import { GroupStatusBadge } from "../../build-status/components/build-status";
import {
    useBuildStatusQuery,
    useSetVisibilityMutation
} from "../../build-status/queries";
import {
    useDeleteGroupMutation,
    useLibraryQuery,
    useSetGroupOrderMutation
} from "../queries";
import { useIsHome, useLibraryId } from "../../../lib/library";

interface GroupCardProps extends PropsWithChildren {
    group: GroupOut;
}

export function GroupCard(props: GroupCardProps): ReactNode {
    const { group } = props;
    const navigate = useNavigate();
    const libraryId = useLibraryId();
    return (
        <ItemRow
            onClick={() => {
                void navigate({
                    to: "/app/library/$libraryId/groups/$groupId",
                    params: { libraryId, groupId: group.id }
                });
            }}
            left={
                <CardTitle
                    title={group.name}
                    disabled={!group.isLoaded}
                    thumbnail={
                        <CardThumbnail
                            smallThumbnailUrl={group.smallThumbnailUrl}
                            largeThumbnailUrl={group.largeThumbnailUrl}
                        />
                    }
                    buildStatusBadge={
                        <GroupStatusBadge
                            groupId={group.id}
                            name={group.name}
                        />
                    }
                />
            }
            rightSection={<ArrowRightIcon size={IconSize.SMALL} />}
            moreButton={false}
            menuItems={<GroupMenuItems group={group} />}
        />
    );
}

interface GroupMenuItemsProps {
    group: GroupOut;
}

export function GroupMenuItems(props: GroupMenuItemsProps): ReactNode {
    const { group } = props;
    return (
        <>
            <OpenDocumentItems path={group.path} />
            <AdminOptionsSubmenu>
                <GroupAdminContextMenu group={group} />
            </AdminOptionsSubmenu>
        </>
    );
}

interface GroupAdminContextMenuProps {
    group: GroupOut;
}

function GroupAdminContextMenu({
    group
}: GroupAdminContextMenuProps): ReactNode {
    const groupId = group.id;
    const isHome = useIsHome();
    const buildStatusQuery = useBuildStatusQuery();
    const libraryQuery = useLibraryQuery();
    const groupStatus = buildStatusQuery.data?.groups[groupId];
    const groupOrder = libraryQuery.data?.groupOrder ?? [];
    const setGroupOrderMutation = useSetGroupOrderMutation();

    if (!groupStatus) return null;

    return (
        <>
            {isHome && (
                <ChangeOrderItems
                    id={groupId}
                    order={groupOrder}
                    onOrderChange={(newOrder) =>
                        setGroupOrderMutation.mutate(newOrder)
                    }
                />
            )}
            <ShowAllElementsMenuItem
                insertableOrder={groupStatus.insertableOrder}
            />
            <HideAllElementsMenuItem
                insertableOrder={groupStatus.insertableOrder}
            />
            <ReloadThumbnailMenuItem target={{ groupId }} />
            {isHome && (
                <>
                    <Menu.Divider />
                    <DeleteGroupMenuItem groupId={groupId} name={group.name} />
                    <AddGroupItem />
                </>
            )}
        </>
    );
}

interface AllElementsVisibilityProps {
    insertableOrder: string[];
}

function ShowAllElementsMenuItem(props: AllElementsVisibilityProps): ReactNode {
    const mutation = useSetVisibilityMutation(props.insertableOrder, true);
    return (
        <Menu.Item
            color={StatusColor.INFO}
            leftSection={<EyeIcon size={IconSize.SMALL} />}
            onClick={() => mutation.mutate()}
        >
            Show all elements
        </Menu.Item>
    );
}

function HideAllElementsMenuItem(props: AllElementsVisibilityProps): ReactNode {
    const mutation = useSetVisibilityMutation(props.insertableOrder, false);
    return (
        <Menu.Item
            color={StatusColor.ERROR}
            leftSection={<EyeSlashIcon size={IconSize.SMALL} />}
            onClick={() => mutation.mutate()}
        >
            Hide all elements
        </Menu.Item>
    );
}

interface DeleteGroupMenuItemProps {
    groupId: string;
    name: string;
}

function DeleteGroupMenuItem(props: DeleteGroupMenuItemProps): ReactNode {
    const { groupId, name } = props;
    const mutation = useDeleteGroupMutation(groupId);

    const confirmDelete = () => {
        modals.openConfirmModal({
            title: (
                <AppTitle
                    icon={
                        <AppIcon
                            icon={WarningIcon}
                            size={IconSize.MEDIUM}
                            color={StatusColor.ERROR}
                        />
                    }
                    title="Delete group"
                />
            ),
            children: (
                <Text size="sm">
                    {`Are you sure you want to delete ${name}? Its elements are deleted with it, and permanently removed from every user's favorites.`}
                </Text>
            ),
            labels: { confirm: "Delete group", cancel: "Cancel" },
            centered: true,
            confirmProps: { color: StatusColor.ERROR },
            onConfirm: () => mutation.mutate()
        });
    };

    return (
        <Menu.Item
            leftSection={<TrashIcon size={IconSize.SMALL} />}
            color={StatusColor.ERROR}
            onClick={confirmDelete}
        >
            Delete
        </Menu.Item>
    );
}
