import { ReactNode, useState } from "react";
import { copyUserData, ElementObj, Favorite, UserData } from "../api/models";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { showErrorToast } from "../common/toaster";
import { queryClient } from "../query-client";
import {
    Alert,
    Card,
    ContextMenu,
    ContextMenuChildrenProps,
    Menu,
    MenuDivider,
    MenuItem
} from "@blueprintjs/core";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { AppMenu } from "../api/menu-params";
import { FavoriteButton } from "./favorite-button";
import {
    CannotDeriveAssemblyAlert,
    CardTitle,
    ContextMenuButton,
    OpenDocumentItems
} from "../cards/card-components";
import {
    useIsElementHidden,
    useIsAssemblyInPartStudio
} from "../cards/card-hooks";
import { ChangeOrderItems } from "../cards/change-order";
import { toUserApiPath, UserPath } from "../api/path";
import { useUiState } from "../api/ui-state";
import { useUserData } from "../queries";
import { router } from "../router";
import { AppAlertProps } from "../common/utils";

interface FavoriteCardProps {
    element: ElementObj;
    favorite: Favorite;
}

/**
 * A card for displaying a Favorited element directly to the user.
 * Very similar in nature to an ElementCard but with a few tweaks.
 */
export function FavoriteCard(props: FavoriteCardProps): ReactNode {
    const { element, favorite } = props;

    const navigate = useNavigate();

    const isHidden = useIsElementHidden(element);
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        element.elementType
    );
    const [isAlertOpen, setIsAlertOpen] = useState(false);

    if (isHidden) {
        return null;
    }

    return (
        <FavoriteContextMenu element={element} favorite={favorite}>
            {(ctxMenuProps: ContextMenuChildrenProps) => (
                <>
                    <Card
                        className="item-card"
                        onContextMenu={ctxMenuProps.onContextMenu}
                        ref={ctxMenuProps.ref}
                        interactive
                        onClick={() => {
                            if (isAssemblyInPartStudio) {
                                setIsAlertOpen(true);
                                return;
                            }

                            navigate({
                                to: ".",
                                search: {
                                    activeMenu: AppMenu.INSERT_MENU,
                                    activeElementId: element.elementId,
                                    defaultConfiguration:
                                        favorite.defaultConfiguration
                                }
                            });
                        }}
                    >
                        <CardTitle
                            disabled={isAssemblyInPartStudio}
                            title={element.name}
                            elementPath={element}
                        />
                        <div className="item-card-right-content">
                            <FavoriteButton isFavorite element={element} />
                            <ContextMenuButton
                                onClick={ctxMenuProps.onContextMenu}
                            />
                        </div>
                    </Card>
                    <CannotDeriveAssemblyAlert
                        isOpen={isAlertOpen}
                        onClose={() => setIsAlertOpen(false)}
                    />
                    {ctxMenuProps.popover}
                </>
            )}
        </FavoriteContextMenu>
    );
}

interface FavoriteContextMenuProps {
    element: ElementObj;
    favorite: Favorite;
    children: any;
}

function FavoriteContextMenu(props: FavoriteContextMenuProps): ReactNode {
    const { children, element, favorite } = props;

    const search = useSearch({ from: "/app" });
    const uiState = useUiState()[0];
    const navigate = useNavigate();

    const setFavoriteOrderMutation = useSetFavoriteOrderMutation(search);
    const favoriteOrder = useUserData().favoriteOrder;

    const [isReorderAlertOpen, setIsReorderAlertOpen] = useState(false);
    const [isEditDefaultConfigAlertOpen, setIsEditDefaultConfigAlertOpen] =
        useState(false);

    const cannotReorderAlert = (
        <CannotReorderAlert
            isOpen={isReorderAlertOpen}
            onClose={() => setIsReorderAlertOpen(false)}
        />
    );

    const cannotEditDefaultConfigAlert = (
        <CannotEditDefaultConfiguration
            isOpen={isEditDefaultConfigAlertOpen}
            onClose={() => setIsEditDefaultConfigAlertOpen(false)}
        />
    );

    const menu = (
        <Menu>
            <MenuItem
                icon="edit"
                text="Edit default configuration"
                intent="primary"
                onClick={() => {
                    if (element.configurationId === undefined) {
                        setIsEditDefaultConfigAlertOpen(true);
                    }
                    navigate({
                        to: ".",
                        search: {
                            activeMenu: AppMenu.FAVORITE_MENU,
                            favoriteId: favorite.id,
                            defaultConfiguration: favorite.defaultConfiguration
                        }
                    });
                }}
            />
            <MenuDivider />
            <ChangeOrderItems
                id={favorite.id}
                order={favoriteOrder}
                onOrderChange={(newOrder) => {
                    if (uiState.vendorFilters !== undefined) {
                        setIsReorderAlertOpen(true);
                        return;
                    }
                    setFavoriteOrderMutation.mutate(newOrder);
                }}
            />
            <MenuDivider />
            <OpenDocumentItems path={element} />
        </Menu>
    );
    return (
        <>
            <ContextMenu content={menu}>{children}</ContextMenu>
            {cannotReorderAlert}
            {cannotEditDefaultConfigAlert}
        </>
    );
}

function CannotReorderAlert(props: AppAlertProps) {
    return (
        <Alert
            intent="warning"
            icon="warning-sign"
            canEscapeKeyCancel
            canOutsideClickCancel
            confirmButtonText="Close"
            onClose={props.onClose}
            isOpen={props.isOpen}
        >
            To prevent confusion, favorites cannot be reordered while filters
            are active.
        </Alert>
    );
}

function CannotEditDefaultConfiguration(props: AppAlertProps) {
    return (
        <Alert
            intent="warning"
            icon="warning-sign"
            canEscapeKeyCancel
            canOutsideClickCancel
            confirmButtonText="Close"
            onClose={props.onClose}
            isOpen={props.isOpen}
        >
            This element is not configurable, so its default configuration
            cannot be changed.
        </Alert>
    );
}

function useSetFavoriteOrderMutation(userPath: UserPath) {
    return useMutation({
        mutationKey: ["set-favorite-order"],
        mutationFn: async (favoriteOrder: string[]) => {
            return apiPost("/favorite-order" + toUserApiPath(userPath), {
                body: { favoriteOrder }
            });
        },
        onMutate: (newOrder: string[]) => {
            queryClient.setQueryData(["user-data"], (data?: UserData) => {
                if (!data) {
                    return undefined;
                }
                const newUserData = copyUserData(data);
                newUserData.favoriteOrder = newOrder;
                return newUserData;
            });
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to reorder favorites.");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["user-data"] });
            router.invalidate();
        }
    });
}
