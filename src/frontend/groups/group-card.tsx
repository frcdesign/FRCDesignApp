import { Menu } from "@mantine/core";
import {
    IconArrowRight,
    IconEye,
    IconEyeOff,
    IconList,
    IconSortAZ,
    IconTrash
} from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
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
import { getGroupStateRows, useGroupBuildIssues } from "../cards/build-status";
import {
    libraryQueryKey,
    libraryQueryMatchKey,
    useLibraryQuery
} from "../queries";
import { toLibraryPath, useLibraryId } from "../api-utils/library";
import { getQueryUpdater, useIsHome } from "../common/utils";
import { getAppErrorHandler } from "../api-utils/errors";

interface GroupCardProps extends PropsWithChildren {
    group: GroupOut;
}

/**
 * A card representing a single group.
 */
export function GroupCard(props: GroupCardProps): ReactNode {
    const { group } = props;
    const navigate = useNavigate();
    const buildIssues = useGroupBuildIssues(group);

    return (
        <ItemRow
            onClick={() => {
                void navigate({
                    to: "/app/groups/$groupId",
                    params: { groupId: group.id }
                });
            }}
            left={
                <CardTitle
                    title={group.name}
                    thumbnailUrls={group.thumbnailUrls}
                    buildIssues={buildIssues}
                    buildStateRows={getGroupStateRows(group)}
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

    const isHome = useIsHome();
    const libraryId = useLibraryId();

    const deleteGroupMutation = useMutation({
        mutationKey: ["delete-group"],
        mutationFn: async () => {
            return apiDelete("/group" + toLibraryPath(libraryId), {
                query: { groupId: group.id }
            });
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
        }
    });

    const setGroupOrderMutation = useSetGroupOrderMutation();
    const groupOrder = useLibraryQuery().data?.groupOrder ?? [];

    const showAllMutation = useSetVisibilityMutation(
        group.insertableOrder,
        true
    );

    const hideAllMutation = useSetVisibilityMutation(
        group.insertableOrder,
        false
    );

    const orderItems = isHome && (
        <ChangeOrderItems
            id={group.id}
            order={groupOrder}
            onOrderChange={(newOrder) => setGroupOrderMutation.mutate(newOrder)}
        />
    );

    const modifyGroupItems = isHome && (
        <>
            <Menu.Divider />
            <Menu.Item
                leftSection={<IconTrash size={IconSize.SMALL} />}
                color="red"
                onClick={() => {
                    deleteGroupMutation.mutate();
                }}
            >
                Delete
            </Menu.Item>
            <AddGroupItem />
        </>
    );

    return (
        <>
            <OpenDocumentItems path={group.path} />
            <AdminOptionsSubmenu>
                {orderItems}
                <Menu.Item
                    color="blue"
                    leftSection={<IconEye size={IconSize.SMALL} />}
                    onClick={() => {
                        showAllMutation.mutate();
                    }}
                >
                    Show all elements
                </Menu.Item>
                <Menu.Item
                    color="red"
                    leftSection={<IconEyeOff size={IconSize.SMALL} />}
                    onClick={() => {
                        hideAllMutation.mutate();
                    }}
                >
                    Hide all elements
                </Menu.Item>
                <GroupDataItems group={group} />
                <ReloadThumbnailMenuItem id={group.id} isGroup={true} />
                {modifyGroupItems}
            </AdminOptionsSubmenu>
        </>
    );
}

function useSetGroupOrderMutation() {
    const libraryId = useLibraryId();
    const cacheVersion = useLoaderData({ from: "/app" }).accessData
        .cacheVersion;
    return useMutation({
        mutationKey: ["group-order"],
        mutationFn: async (groupOrder: string[]) => {
            return apiPost("/group-order" + toLibraryPath(libraryId), {
                body: { groupOrder }
            });
        },
        onMutate: (newOrder: string[]) => {
            queryClient.setQueryData(
                libraryQueryKey(libraryId, cacheVersion),
                getQueryUpdater((data: LibraryOut) => {
                    data.groupOrder = newOrder;
                    return data;
                })
            );
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to reorder group.");
            void queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
        }
        // Don't need an onSettled handler since group-order doesn't expire
    });
}

function useToggleSortOrderMutation(group: GroupOut) {
    const libraryId = useLibraryId();
    const cacheVersion = useLoaderData({ from: "/app" }).accessData
        .cacheVersion;

    return useMutation({
        mutationKey: ["sort-group-alphabetically"],
        mutationFn: async () => {
            return apiPost(
                "/sort-group-alphabetically" + toLibraryPath(libraryId),
                {
                    body: {
                        groupId: group.id,
                        sortAlphabetically: !group.sortAlphabetically
                    }
                }
            );
        },
        onMutate: () => {
            queryClient.setQueryData(
                libraryQueryKey(libraryId, cacheVersion),
                getQueryUpdater((data: LibraryOut) => {
                    const oldGroup = data.groups[group.id];
                    if (oldGroup) {
                        oldGroup.sortAlphabetically = !group.sortAlphabetically;
                    }
                    return data;
                })
            );
        },
        onError: getAppErrorHandler(`Failed to update group ${group.name}.`),
        onSettled: () => {
            void queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
        }
    });
}

interface GroupDataItemsProps {
    group: GroupOut;
}

function GroupDataItems({ group }: GroupDataItemsProps) {
    const toggleSortOrderMutation = useToggleSortOrderMutation(group);
    return (
        <Menu.Item
            leftSection={
                group.sortAlphabetically ? (
                    <IconList size={IconSize.SMALL} />
                ) : (
                    <IconSortAZ size={IconSize.SMALL} />
                )
            }
            onClick={() => {
                toggleSortOrderMutation.mutate();
            }}
        >
            {group.sortAlphabetically ? "Use tab order" : "Sort alphabetically"}
        </Menu.Item>
    );
}
