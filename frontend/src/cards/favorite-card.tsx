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
    MenuDivider
} from "@blueprintjs/core";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { AppMenu } from "../api/menu-params";
import { FavoriteButton } from "./favorite-button";
import {
    CannotDeriveAssemblyAlert,
    CardTitle,
    ContextMenuButton,
    OpenDocumentItem
} from "./card-components";
import { useIsElementHidden, useIsAssemblyInPartStudio } from "./card-hooks";
import { ChangeOrderItems } from "./change-order";
import { ElementPath, toUserApiPath, UserPath } from "../api/path";
import { useUiState } from "../api/ui-state";
import { useUserData } from "../queries";
import { router } from "../router";

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
        <FavoriteContextMenu path={element} favorite={favorite}>
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
                                        favorite?.defaultConfiguration
                                }
                            });
                        }}
                    >
                        <CardTitle
                            disabled={isAssemblyInPartStudio}
                            title={element.name}
                            elementPath={element}
                            showHiddenTag={!element.isVisible}
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
    path: ElementPath;
    favorite: Favorite;
    children: any;
}

function FavoriteContextMenu(props: FavoriteContextMenuProps): ReactNode {
    const { children, path, favorite } = props;

    const search = useSearch({ from: "/app" });
    const uiState = useUiState()[0];

    const setFavoriteOrderMutation = useSetFavoriteOrderMutation(search);
    const favoriteOrder = useUserData().favoriteOrder;

    const [isAlertOpen, setIsAlertOpen] = useState(false);

    const alert = (
        <Alert
            intent="warning"
            icon="warning-sign"
            canEscapeKeyCancel
            canOutsideClickCancel
            confirmButtonText="Close"
            onClose={() => setIsAlertOpen(false)}
            isOpen={isAlertOpen}
        >
            To prevent confusion, favorites cannot be reordered while filters
            are active.
        </Alert>
    );

    const menu = (
        <Menu>
            <ChangeOrderItems
                id={favorite.id}
                order={favoriteOrder}
                onOrderChange={(newOrder) => {
                    if (uiState.vendorFilters !== undefined) {
                        setIsAlertOpen(true);
                        return;
                    }
                    setFavoriteOrderMutation.mutate(newOrder);
                }}
            />
            <MenuDivider />
            <OpenDocumentItem path={path} />
        </Menu>
    );
    return (
        <>
            <ContextMenu content={menu}>{children}</ContextMenu>
            {alert}
        </>
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
            queryClient.setQueryData(["user-data"], (data: UserData) => {
                const newUserData = copyUserData(data);
                newUserData.favoriteOrder = newOrder;
                return newUserData;
            });
            router.invalidate();
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to reorder favorites.");
            queryClient.refetchQueries({ queryKey: ["user-data"] });
            router.invalidate();
        }
    });
}
