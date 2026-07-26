import { Menu } from "@mantine/core";
import {
    IconBarcode,
    IconCircleCheck,
    IconCircleOff,
    IconEye,
    IconEyeOff,
    IconPlus
} from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { useRouter } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import {
    Favorite,
    getFavoriteForInsertable,
    InsertableOut
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
    libraryQueryMatchKey,
    useBuildStatusQuery,
    useFavoritesQuery
} from "../queries";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { showSuccessToast } from "../common/notifications";
import { toInsertablePath } from "../api-utils/library";
import { getAppErrorHandler } from "../api-utils/errors";

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

                openInsertMenu({
                    insertable,
                    defaultConfiguration: searchHit?.configuration
                });
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
                <InsertableAdminContextMenu
                    insertableId={insertable.id}
                    elementType={insertable.elementType}
                />
            </AdminOptionsSubmenu>
        </>
    );
}

interface InsertableAdminContextMenuProps {
    insertableId: string;
    elementType: ElementType;
}

export function InsertableAdminContextMenu(
    props: InsertableAdminContextMenuProps
): ReactNode {
    const { insertableId, elementType } = props;
    const insertableBuild =
        useBuildStatusQuery().data?.insertables[insertableId];

    if (!insertableBuild) return null;

    return (
        <>
            <ToggleVisibilityMenuItem
                insertableId={insertableId}
                isVisible={insertableBuild.isVisible}
            />
            <ReloadThumbnailMenuItem id={insertableId} isGroup={false} />
            {elementType === ElementType.PART_STUDIO && (
                <ToggleOpenCompositeMenuItem
                    insertableId={insertableId}
                    isOpenComposite={insertableBuild.isOpenComposite}
                />
            )}
            <ToggleInsertAndFastenMenuItem
                insertableId={insertableId}
                supportsFasten={insertableBuild.supportsFasten}
            />
            <TogglePartNumberSearchMenuItem
                insertableId={insertableId}
                searchPartNumbers={insertableBuild.searchPartNumbers}
            />
        </>
    );
}

interface ToggleVisibilityMenuItemProps {
    insertableId: string;
    isVisible: boolean;
}

function ToggleVisibilityMenuItem({
    insertableId,
    isVisible
}: ToggleVisibilityMenuItemProps): ReactNode {
    const mutation = useSetVisibilityMutation([insertableId], !isVisible);
    return (
        <Menu.Item
            onClick={() => mutation.mutate()}
            color={isVisible ? "red" : "blue"}
            leftSection={
                isVisible ? (
                    <IconEyeOff size={IconSize.SMALL} />
                ) : (
                    <IconEye size={IconSize.SMALL} />
                )
            }
        >
            {isVisible ? "Hide element" : "Show element"}
        </Menu.Item>
    );
}

interface ToggleOpenCompositeMenuItemProps {
    insertableId: string;
    isOpenComposite: boolean;
}

function ToggleOpenCompositeMenuItem({
    insertableId,
    isOpenComposite
}: ToggleOpenCompositeMenuItemProps): ReactNode {
    const router = useRouter();

    const mutation = useMutation({
        mutationKey: ["toggle-open-composite"],
        mutationFn: () =>
            apiPost("/toggle-open-composite" + toInsertablePath(insertableId), {
                body: { isOpenComposite: !isOpenComposite }
            }),
        onError: getAppErrorHandler("Failed to update open composite setting."),
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
        <Menu.Item
            onClick={() => mutation.mutate()}
            color={isOpenComposite ? "yellow" : undefined}
            leftSection={
                isOpenComposite ? (
                    <IconCircleOff size={IconSize.SMALL} />
                ) : (
                    <IconCircleCheck size={IconSize.SMALL} />
                )
            }
        >
            {isOpenComposite ? "No open composites" : "Has open composite"}
        </Menu.Item>
    );
}

interface ToggleInsertAndFastenMenuItemProps {
    insertableId: string;
    supportsFasten: boolean;
}

function ToggleInsertAndFastenMenuItem({
    insertableId,
    supportsFasten
}: ToggleInsertAndFastenMenuItemProps): ReactNode {
    const router = useRouter();

    const mutation = useMutation({
        mutationKey: ["toggle-insert-and-fasten"],
        mutationFn: (newValue: boolean) =>
            apiPost(
                "/toggle-insert-and-fasten" + toInsertablePath(insertableId),
                {
                    body: { supportsFasten: newValue }
                }
            ),
        onSuccess: (_result, newValue: boolean) => {
            if (newValue) {
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
        <Menu.Item
            onClick={() => mutation.mutate(!supportsFasten)}
            color={supportsFasten ? "red" : "blue"}
            leftSection={
                supportsFasten ? (
                    <IconCircleOff size={IconSize.SMALL} />
                ) : (
                    <IconPlus size={IconSize.SMALL} />
                )
            }
        >
            {supportsFasten
                ? "Disable insert and fasten"
                : "Enable Insert and fasten"}
        </Menu.Item>
    );
}

interface TogglePartNumberSearchMenuItemProps {
    insertableId: string;
    searchPartNumbers: boolean;
}

function TogglePartNumberSearchMenuItem({
    insertableId,
    searchPartNumbers
}: TogglePartNumberSearchMenuItemProps): ReactNode {
    const router = useRouter();

    const mutation = useMutation({
        mutationKey: ["toggle-part-number-search"],
        mutationFn: (newValue: boolean) =>
            apiPost(
                "/toggle-part-number-search" + toInsertablePath(insertableId),
                {
                    body: { searchPartNumbers: newValue }
                }
            ),
        onSuccess: (_result, newValue: boolean) => {
            if (newValue) {
                showSuccessToast("Successfully enabled part number search.");
            }
        },
        onError: getAppErrorHandler("Failed to update part number search."),
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
        <Menu.Item
            onClick={() => mutation.mutate(!searchPartNumbers)}
            color={searchPartNumbers ? "red" : "blue"}
            leftSection={
                searchPartNumbers ? (
                    <IconCircleOff size={IconSize.SMALL} />
                ) : (
                    <IconBarcode size={IconSize.SMALL} />
                )
            }
        >
            {searchPartNumbers
                ? "Disable part number search"
                : "Enable part number search"}
        </Menu.Item>
    );
}
