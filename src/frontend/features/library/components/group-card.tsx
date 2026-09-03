import { Menu } from "@mantine/core";
import {
    ArrowRightIcon,
    EyeIcon,
    EyeSlashIcon,
    TrashIcon
} from "@phosphor-icons/react";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import { GroupOut, LibraryOut } from "@backend/features/library/contract";
import { useMutation } from "@tanstack/react-query";
import { apiPost, apiDelete } from "../../../lib/api-client";
import { showErrorToast } from "../../../lib/notifications";
import { queryClient } from "../../../lib/query-client";
import { ChangeOrderItems } from "../../../components/change-order";
import { useSetVisibilityMutation } from "../card-hooks";
import {
    AdminOptionsSubmenu,
    CardTitle,
    ItemRow,
    OpenDocumentItems
} from "./card-components";
import { AddGroupItem } from "./add-group-menu";
import { CardThumbnail } from "../../thumbnails/components/thumbnail";
import { GroupStatusBadge } from "../../build-status/components/build-status";
import { useRefreshLibrary } from "../../../lib/refresh";
import { useBuildStatusQuery } from "../../build-status/queries";
import { useCacheVersion, useLibraryQuery } from "../queries";
import { libraryDataQueryKey } from "../../../lib/query-keys";
import { toLibraryPath, useIsHome, useLibraryId } from "../library-path";
import { getQueryUpdater } from "../../../lib/query-cache";

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
                            groupName={group.name}
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
}

function DeleteGroupMenuItem(props: DeleteGroupMenuItemProps): ReactNode {
    const { groupId } = props;
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
            leftSection={<TrashIcon size={IconSize.SMALL} />}
            color={StatusColor.ERROR}
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
    const key = libraryDataQueryKey(libraryId, cacheVersion);

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
