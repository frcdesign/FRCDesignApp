import { Menu } from "@mantine/core";
import {
    IconArrowRight,
    IconEye,
    IconEyeOff,
    IconTrash
} from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import { GroupOut, LibraryOut } from "../../shared/api-models";
import { useMutation } from "@tanstack/react-query";
import { apiPost, apiDelete } from "../api-utils/api";
import { showErrorToast } from "../common/notifications";
import { queryClient } from "../query-client";
import { ChangeOrderItems } from "../common/change-order";
import { useSetVisibilityMutation } from "../cards/card-hooks";
import {
    AdminOptionsSubmenu,
    CardTitle,
    ItemRow,
    OpenDocumentItems,
    ReloadThumbnailMenuItem
} from "../cards/card-components";
import { AddGroupItem } from "./add-group-menu";
import { GroupStatusBadge } from "../cards/build-status";
import { useRefreshLibrary } from "../api-utils/refresh";
import {
    libraryQueryKey,
    useBuildStatusQuery,
    useLibraryQuery
} from "../queries";
import {
    toLibraryPath,
    useCacheVersion,
    useLibraryId
} from "../api-utils/library";
import { getQueryUpdater, useIsHome } from "../common/utils";

interface GroupCardProps extends PropsWithChildren {
    group: GroupOut;
}

/**
 * A card representing a single group.
 */
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
                    thumbnailUrls={group.thumbnailUrls}
                    buildStatusBadge={
                        <GroupStatusBadge
                            groupId={group.id}
                            groupName={group.name}
                        />
                    }
                />
            }
            rightSection={<IconArrowRight size={IconSize.SMALL} />}
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
                <GroupAdminContextMenu groupId={group.id} />
            </AdminOptionsSubmenu>
        </>
    );
}

interface GroupAdminContextMenuProps {
    groupId: string;
}

export function GroupAdminContextMenu({
    groupId
}: GroupAdminContextMenuProps): ReactNode {
    const isHome = useIsHome();
    const groupStatus = useBuildStatusQuery().data?.groups[groupId];
    const groupOrder = useLibraryQuery().data?.groupOrder ?? [];
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
            <ReloadThumbnailMenuItem id={groupId} isGroup={true} />
            {isHome && (
                <>
                    <Menu.Divider />
                    <DeleteGroupMenuItem groupId={groupId} />
                    <AddGroupItem />
                </>
            )}
        </>
    );
}

function ShowAllElementsMenuItem({
    insertableOrder
}: {
    insertableOrder: string[];
}): ReactNode {
    const mutation = useSetVisibilityMutation(insertableOrder, true);
    return (
        <Menu.Item
            color="blue"
            leftSection={<IconEye size={IconSize.SMALL} />}
            onClick={() => mutation.mutate()}
        >
            Show all elements
        </Menu.Item>
    );
}

function HideAllElementsMenuItem({
    insertableOrder
}: {
    insertableOrder: string[];
}): ReactNode {
    const mutation = useSetVisibilityMutation(insertableOrder, false);
    return (
        <Menu.Item
            color="red"
            leftSection={<IconEyeOff size={IconSize.SMALL} />}
            onClick={() => mutation.mutate()}
        >
            Hide all elements
        </Menu.Item>
    );
}

function DeleteGroupMenuItem({ groupId }: { groupId: string }): ReactNode {
    const libraryId = useLibraryId();
    const refreshLibrary = useRefreshLibrary();

    const mutation = useMutation({
        mutationKey: ["delete-group"],
        mutationFn: async () =>
            apiDelete("/group" + toLibraryPath(libraryId), {
                query: { groupId }
            }),
        // Deleting cascade-removes insertables (and their favorites), so refresh
        // the whole view, not just the library list.
        onSuccess: refreshLibrary
    });

    return (
        <Menu.Item
            leftSection={<IconTrash size={IconSize.SMALL} />}
            color="red"
            onClick={() => mutation.mutate()}
        >
            Delete
        </Menu.Item>
    );
}

function useSetGroupOrderMutation() {
    const libraryId = useLibraryId();
    const cacheVersion = useCacheVersion();
    const refreshLibrary = useRefreshLibrary();
    const key = libraryQueryKey(libraryId, cacheVersion);

    return useMutation({
        mutationKey: ["group-order"],
        mutationFn: async (groupOrder: string[]) =>
            apiPost("/group-order" + toLibraryPath(libraryId), {
                body: { groupOrder }
            }),
        onMutate: async (newOrder: string[]) => {
            await queryClient.cancelQueries({ queryKey: key });
            queryClient.setQueryData(
                key,
                getQueryUpdater((data: LibraryOut) => {
                    data.groupOrder = newOrder;
                    return data;
                })
            );
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to reorder group.");
        },
        // Reconciled (or rolled back on error) by the onSettled library refetch.
        onSettled: refreshLibrary
    });
}
