import { Menu } from "@mantine/core";
import {
    IconCircleCheck,
    IconCircleOff,
    IconEye,
    IconEyeOff,
    IconPlus
} from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import {
    Favorite,
    getFavoriteForInsertable,
    InsertableOut,
    LibraryOut
} from "../../shared/api-models";
import { ElementType } from "../../shared/types";
import { SearchHit } from "../search/search";
import {
    FavoriteButton,
    FavoriteInsertableItem
} from "../favorites/favorite-button";
import { useIsInsertableHidden, useSetVisibilityMutation } from "./card-hooks";
import { InsertableStatusBadge } from "./build-status";
import {
    AdminOptionsSubmenu,
    CardTitle,
    ItemRow,
    OpenDocumentItems,
    QuickInsertItems,
    ReloadThumbnailMenuItem
} from "./card-components";
import { openCannotDeriveAssemblyAlert } from "../app/alerts";
import { useIsAssemblyInPartStudio } from "../insert/insert-hooks";
import { openInsertMenu } from "../insert/insert-menu";
import {
    contextDataQueryKey,
    libraryQueryKey,
    libraryQueryMatchKey,
    useFavoritesQuery
} from "../queries";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { showSuccessToast } from "../common/notifications";
import { toInsertablePath, useLibraryId } from "../api-utils/library";
import { getAppErrorHandler } from "../api-utils/errors";
import { getQueryUpdater } from "../common/utils";

interface InsertableCardProps extends PropsWithChildren {
    insertable: InsertableOut;
    searchHit?: SearchHit;
    onClick?: () => void;
}

/**
 * A card representing a part studio or assembly.
 */
export function InsertableCard(props: InsertableCardProps): ReactNode {
    const { insertable, searchHit } = props;

    const favorites = useFavoritesQuery().data?.favorites;

    const isHidden = useIsInsertableHidden(insertable);

    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );

    if (isHidden || !favorites) {
        return null;
    }

    const favorite = getFavoriteForInsertable(favorites, insertable.id);

    return (
        <ItemRow
            onClick={() => {
                if (props.onClick) {
                    props.onClick();
                }

                if (isAssemblyInPartStudio) {
                    openCannotDeriveAssemblyAlert();
                    return;
                }

                openInsertMenu({ insertable });
            }}
            left={
                <CardTitle
                    disabled={isAssemblyInPartStudio}
                    searchHit={searchHit}
                    title={insertable.name}
                    thumbnailUrls={insertable.thumbnailUrls}
                    showHiddenTag={!insertable.isVisible}
                    buildStatusBadge={
                        <InsertableStatusBadge insertableId={insertable.id} />
                    }
                />
            }
            rightSection={
                <FavoriteButton favorite={favorite} insertable={insertable} />
            }
            menuItems={
                <InsertableMenuItems
                    favorite={favorite}
                    insertable={insertable}
                />
            }
        />
    );
}

interface InsertableMenuItemsProps {
    favorite: Favorite | undefined;
    insertable: InsertableOut;
}

export function InsertableMenuItems(
    props: InsertableMenuItemsProps
): ReactNode {
    const { favorite, insertable } = props;

    return (
        <>
            <QuickInsertItems
                insertable={insertable}
                isFavorite={favorite !== undefined}
            />
            <Menu.Divider />
            <FavoriteInsertableItem
                favorite={favorite}
                insertable={insertable}
            />
            <Menu.Divider />
            <OpenDocumentItems path={insertable.path} />
            <AdminOptionsSubmenu>
                <InsertableAdminContextMenu insertable={insertable} />
            </AdminOptionsSubmenu>
        </>
    );
}

interface InsertableAdminContextMenuProps {
    insertable: InsertableOut;
}

export function InsertableAdminContextMenu(
    props: InsertableAdminContextMenuProps
): ReactNode {
    const { insertable } = props;

    const libraryId = useLibraryId();
    const loaderData = useLoaderData({ from: "/app" });
    const router = useRouter();

    const setVisibilityMutation = useSetVisibilityMutation(
        [insertable.id],
        !insertable.isVisible
    );

    const setOpenCompositeMutation = useMutation({
        mutationKey: ["toggle-open-composite"],
        mutationFn: () => {
            return apiPost(
                "/toggle-open-composite" + toInsertablePath(insertable.id),
                {
                    body: { isOpenComposite: !insertable.isOpenComposite }
                }
            );
        },
        onError: getAppErrorHandler("Failed to update open composite setting."),
        onMutate: () => {
            void queryClient.cancelQueries({
                queryKey: libraryQueryMatchKey()
            });
            queryClient.setQueryData(
                libraryQueryKey(libraryId, loaderData.accessData.cacheVersion),
                getQueryUpdater((data: LibraryOut) => {
                    const current = data.insertables[insertable.id];
                    if (current) {
                        current.isOpenComposite = !insertable.isOpenComposite;
                    }
                    return data;
                })
            );
        },
        onSettled: async () => {
            await queryClient.refetchQueries({
                queryKey: contextDataQueryKey()
            });
            await queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
            void router.invalidate();
        }
    });

    const setSupportsFastenMutation = useMutation({
        mutationKey: ["toggle-insert-and-fasten"],
        mutationFn: (supportsFasten: boolean) => {
            return apiPost(
                "/toggle-insert-and-fasten" + toInsertablePath(insertable.id),
                { body: { supportsFasten } }
            );
        },
        onSuccess: (_result, supportsFasten: boolean) => {
            if (supportsFasten) {
                showSuccessToast("Successfully enabled Insert and fasten.");
            }
        },
        onError: getAppErrorHandler("Failed to enable Insert and fasten."),
        onSettled: async () => {
            await queryClient.refetchQueries({
                queryKey: contextDataQueryKey()
            });
            await queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
            void router.invalidate();
        }
    });

    return (
        <>
            <Menu.Item
                onClick={() => setVisibilityMutation.mutate()}
                color={insertable.isVisible ? "red" : "blue"}
                leftSection={
                    insertable.isVisible ? (
                        <IconEyeOff size={IconSize.SMALL} />
                    ) : (
                        <IconEye size={IconSize.SMALL} />
                    )
                }
            >
                {insertable.isVisible ? "Hide element" : "Show element"}
            </Menu.Item>
            <ReloadThumbnailMenuItem id={insertable.id} isGroup={false} />
            {insertable.elementType === ElementType.PART_STUDIO && (
                <Menu.Item
                    onClick={() => setOpenCompositeMutation.mutate()}
                    color={insertable.isOpenComposite ? "yellow" : undefined}
                    leftSection={
                        insertable.isOpenComposite ? (
                            <IconCircleOff size={IconSize.SMALL} />
                        ) : (
                            <IconCircleCheck size={IconSize.SMALL} />
                        )
                    }
                >
                    {insertable.isOpenComposite
                        ? "No open composites"
                        : "Has open composite"}
                </Menu.Item>
            )}
            <Menu.Item
                onClick={() =>
                    setSupportsFastenMutation.mutate(!insertable.supportsFasten)
                }
                color={insertable.supportsFasten ? "red" : "blue"}
                leftSection={
                    insertable.supportsFasten ? (
                        <IconCircleOff size={IconSize.SMALL} />
                    ) : (
                        <IconPlus size={IconSize.SMALL} />
                    )
                }
            >
                {insertable.supportsFasten
                    ? "Disable insert and fasten"
                    : "Enable Insert and fasten"}
            </Menu.Item>
        </>
    );
}
