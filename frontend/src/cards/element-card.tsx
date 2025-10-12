import {
    ContextMenuChildrenProps,
    Card,
    ContextMenu,
    Menu,
    MenuDivider,
    MenuItem
} from "@blueprintjs/core";
import { useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import { ElementObj } from "../api/models";
import { SearchHit } from "../search/search";
import {
    FavoriteButton,
    FavoriteElementItem
} from "../favorites/favorite-button";
import { useUserData } from "../queries";
import { RequireAccessLevel } from "../api/access-level";
import { useIsElementHidden, useSetVisibilityMutation } from "./card-hooks";
import {
    CardTitle,
    ContextMenuButton,
    OpenDocumentItems,
    QuickInsertItem
} from "./card-components";
import { AlertType, useOpenAlert } from "../search-params/alert-type";
import { useIsAssemblyInPartStudio } from "../insert/insert-hooks";
import { MenuType } from "../search-params/menu-params";

interface ElementCardProps extends PropsWithChildren {
    element: ElementObj;
    searchHit?: SearchHit;
    onClick?: () => void;
}

/**
 * A card representing a part studio or assembly.
 */
export function ElementCard(props: ElementCardProps): ReactNode {
    const { element, searchHit } = props;
    const navigate = useNavigate();

    const userData = useUserData();

    const isHidden = useIsElementHidden(element);

    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        element.elementType
    );
    const openAlert = useOpenAlert();

    if (isHidden) {
        return null;
    }

    const isFavorite = userData.favorites[element.elementId] !== undefined;

    return (
        <ElementContextMenu isFavorite={isFavorite} element={element}>
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
                                openAlert(AlertType.CANNOT_DERIVE_ASSEMBLY);
                                return;
                            }

                            navigate({
                                to: ".",
                                search: {
                                    activeMenu: MenuType.INSERT_MENU,
                                    activeElementId: element.elementId
                                }
                            });
                        }}
                    >
                        <CardTitle
                            disabled={isAssemblyInPartStudio}
                            searchHit={searchHit}
                            title={element.name}
                            elementPath={element}
                            showHiddenTag={!element.isVisible}
                        />
                        <div className="item-card-right-content">
                            <FavoriteButton
                                isFavorite={isFavorite}
                                element={element}
                            />
                            <ContextMenuButton
                                onClick={ctxMenuProps.onContextMenu}
                            />
                        </div>
                    </Card>
                    {ctxMenuProps.popover}
                </>
            )}
        </ElementContextMenu>
    );
}

interface ElementContextMenuProps {
    isFavorite: boolean;
    element: ElementObj;
    children: any;
}

export function ElementContextMenu(props: ElementContextMenuProps) {
    const { children, isFavorite, element } = props;

    const mutation = useSetVisibilityMutation(
        "set-visibility",
        [element.id],
        !element.isVisible
    );

    const menu = (
        <Menu>
            <QuickInsertItem element={element} isFavorite={isFavorite} />
            <MenuDivider />
            <OpenDocumentItems path={element} />
            <MenuDivider />
            <FavoriteElementItem isFavorite={isFavorite} element={element} />
            <RequireAccessLevel>
                <MenuDivider />
                <MenuItem
                    onClick={() => {
                        mutation.mutate();
                    }}
                    intent={element.isVisible ? "danger" : "primary"}
                    icon={element.isVisible ? "eye-off" : "eye-open"}
                    text={element.isVisible ? "Hide element" : "Show element"}
                />
            </RequireAccessLevel>
        </Menu>
    );

    return <ContextMenu content={menu}>{children}</ContextMenu>;
}
