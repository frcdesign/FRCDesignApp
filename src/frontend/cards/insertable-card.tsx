import {
    ContextMenuChildrenProps,
    Card,
    ContextMenu,
    Menu,
    MenuDivider,
    MenuItem
} from "@blueprintjs/core";
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
import { AppPopup, useOpenPopup } from "../overlays/popup-params";
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
import { toElementApiPath } from "../../shared/path";
import { showSuccessToast } from "../common/toaster";
import { toLibraryPath, useLibrary } from "../api-utils/library";
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
    const openAlert = useOpenPopup();

    if (isHidden || !favorites) {
        return null;
    }

    const favorite = getFavoriteForInsertable(favorites, insertable.id);

    return (
        <InsertableContextMenu favorite={favorite} insertable={insertable}>
            {(ctxMenuProps: ContextMenuChildrenProps) => (
                <>
                    <Card
                        className="item-card"
                        onContextMenu={ctxMenuProps.onContextMenu}
                        ref={ctxMenuProps.ref}
                        interactive
                        onClick={() => {
                            if (props.onClick) {
                                props.onClick();
                            }

                            if (isAssemblyInPartStudio) {
                                openAlert(AppPopup.CANNOT_DERIVE_ASSEMBLY);
                                return;
                            }

                            navigate({
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
                            <ContextMenuButton
                                onClick={ctxMenuProps.onContextMenu}
                            />
                        </div>
                    </Card>
                    {ctxMenuProps.popover}
                </>
            )}
        </InsertableContextMenu>
    );
}

interface InsertableContextMenuProps {
    favorite: Favorite | undefined;
    insertable: InsertableOut;
    children: any;
}

export function InsertableContextMenu(props: InsertableContextMenuProps) {
    const { children, favorite, insertable } = props;

    const menu = (
        <Menu>
            <QuickInsertItems
                insertable={insertable}
                isFavorite={favorite !== undefined}
            />
            <MenuDivider />
            <FavoriteInsertableItem
                favorite={favorite}
                insertable={insertable}
            />
            <MenuDivider />
            <OpenDocumentItems path={insertable.path} />
            <AdminSubmenu>
                <InsertableAdminContextMenu insertable={insertable} />
            </AdminSubmenu>
        </Menu>
    );

    return <ContextMenu content={menu}>{children}</ContextMenu>;
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
        mutationKey: ["is-open-composite"],
        mutationFn: () => {
            return apiPost("/is-open-composite" + toLibraryPath(library), {
                body: {
                    isOpenComposite: !insertable.isOpenComposite,
                    documentId: insertable.documentId,
                    insertableId: insertable.id
                }
            });
        },
        onMutate: () => {
            queryClient.cancelQueries({ queryKey: libraryQueryMatchKey() });
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
            router.invalidate();
        }
    });

    const setSupportsFastenMutation = useMutation({
        mutationKey: ["supports-fasten"],
        mutationFn: (supportsFasten: boolean) => {
            return apiPost(
                "/supports-fasten" +
                    toLibraryPath(library) +
                    toElementApiPath(insertable.path),
                {
                    body: { supportsFasten }
                }
            );
        },
        onSuccess: (_result, supportsFasten: boolean) => {
            if (supportsFasten) {
                showSuccessToast("Successfully enabled Insert and fasten.");
            }
        },
        onError: getAppErrorHandler("Failed to enable Insert and fasten."),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: libraryQueryMatchKey() });
        }
    });

    return (
        <>
            <MenuItem
                onClick={() => setVisibilityMutation.mutate()}
                intent={insertable.isVisible ? "danger" : "primary"}
                icon={insertable.isVisible ? "eye-off" : "eye-open"}
                text={insertable.isVisible ? "Hide element" : "Show element"}
            />
            <ReloadThumbnailMenuItem path={insertable.path} />
            {insertable.elementType === ElementType.PART_STUDIO && (
                <MenuItem
                    onClick={() => setOpenCompositeMutation.mutate()}
                    intent={insertable.isOpenComposite ? "warning" : undefined}
                    icon={insertable.isOpenComposite ? "disable" : "confirm"}
                    text={
                        insertable.isOpenComposite
                            ? "No open composites"
                            : "Has open composite"
                    }
                />
            )}
            <MenuItem
                onClick={() =>
                    setSupportsFastenMutation.mutate(!insertable.supportsFasten)
                }
                intent={insertable.supportsFasten ? "danger" : "primary"}
                icon={insertable.supportsFasten ? "disable" : "add"}
                text={
                    insertable.supportsFasten
                        ? "Disable insert and fasten"
                        : "Enable Insert and fasten"
                }
            />
        </>
    );
}
