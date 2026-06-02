import { Card, Menu } from "@mantine/core";
import {
    IconCircleCheck,
    IconCircleOff,
    IconEye,
    IconEyeOff,
    IconPlus
} from "@tabler/icons-react";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
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
import {
    AdminSubmenu,
    CardTitle,
    ContextMenuButton,
    OpenDocumentItems,
    QuickInsertItems,
    ReloadThumbnailMenuItem
} from "./card-components";
import { openCannotDeriveAssemblyAlert } from "../overlays/alerts";
import { useIsAssemblyInPartStudio } from "../insert/insert-hooks";
import { MenuType } from "../overlays/menu-params";
import {
    libraryQueryKey,
    libraryQueryMatchKey,
    useFavoritesQuery
} from "../queries";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { showSuccessToast } from "../common/toaster";
import { toInsertablePath, useLibrary } from "../api-utils/library";
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
    const navigate = useNavigate();

    const favorites = useFavoritesQuery().data?.favorites;

    const isHidden = useIsInsertableHidden(insertable);

    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );

    if (isHidden || !favorites) {
        return null;
    }

    const favorite = getFavoriteForInsertable(favorites, insertable.id);

    const menuItems = (
        <InsertableMenuItems favorite={favorite} insertable={insertable} />
    );

    return (
        <Menu shadow="md" width={220} withinPortal>
            <Menu.ContextMenu>
                <Card
                    withBorder
                    padding="sm"
                    radius="md"
                    className="item-card"
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                        if (props.onClick) {
                            props.onClick();
                        }

                        if (isAssemblyInPartStudio) {
                            openCannotDeriveAssemblyAlert();
                            return;
                        }

                        void navigate({
                            to: ".",
                            search: {
                                activeMenu: MenuType.INSERT_MENU,
                                activeInsertableId: insertable.id
                            }
                        });
                    }}
                >
                    <CardTitle
                        disabled={isAssemblyInPartStudio}
                        searchHit={searchHit}
                        title={insertable.name}
                        thumbnailUrls={insertable.thumbnailUrls}
                        showHiddenTag={!insertable.isVisible}
                    />
                    <div className="item-card-right-content">
                        <FavoriteButton
                            favorite={favorite}
                            insertable={insertable}
                        />
                        <ContextMenuButton>{menuItems}</ContextMenuButton>
                    </div>
                </Card>
            </Menu.ContextMenu>
            <Menu.Dropdown>{menuItems}</Menu.Dropdown>
        </Menu>
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
            <AdminSubmenu>
                <InsertableAdminContextMenu insertable={insertable} />
            </AdminSubmenu>
        </>
    );
}

interface InsertableAdminContextMenuProps {
    insertable: InsertableOut;
}

export function InsertableAdminContextMenu(
    props: InsertableAdminContextMenuProps
) {
    const { insertable } = props;

    const library = useLibrary();
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
                libraryQueryKey(library, loaderData),
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
        onSettled: () => {
            void queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
        }
    });

    return (
        <>
            <Menu.Item
                onClick={() => setVisibilityMutation.mutate()}
                color={insertable.isVisible ? "red" : "blue"}
                leftSection={
                    insertable.isVisible ? (
                        <IconEyeOff size={16} />
                    ) : (
                        <IconEye size={16} />
                    )
                }
            >
                {insertable.isVisible ? "Hide element" : "Show element"}
            </Menu.Item>
            <ReloadThumbnailMenuItem id={insertable.id} isDocumentId={false} />
            {insertable.elementType === ElementType.PART_STUDIO && (
                <Menu.Item
                    onClick={() => setOpenCompositeMutation.mutate()}
                    color={insertable.isOpenComposite ? "yellow" : undefined}
                    leftSection={
                        insertable.isOpenComposite ? (
                            <IconCircleOff size={16} />
                        ) : (
                            <IconCircleCheck size={16} />
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
                        <IconCircleOff size={16} />
                    ) : (
                        <IconPlus size={16} />
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
