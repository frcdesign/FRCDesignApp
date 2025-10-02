import {
    ContextMenuChildrenProps,
    Card,
    ContextMenu,
    Menu,
    MenuDivider,
    MenuItem
} from "@blueprintjs/core";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useState } from "react";
import { AppMenu } from "../api/menu-params";
import { ElementObj } from "../api/models";
import { SearchHit } from "../app/search";
import { FavoriteButton } from "./favorite-button";
import { useDocumentsQuery, useFavoritesQuery } from "../queries";
import { RequireAccessLevel } from "../api/access-level";
import {
    useIsAssemblyInPartStudio,
    useIsElementHidden,
    useSetVisibilityMutation
} from "./card-hooks";
import {
    CannotDeriveAssemblyAlert,
    CardTitle,
    ContextMenuButton,
    OpenDocumentItem
} from "./card-components";

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
    const search = useSearch({ from: "/app" });
    const data = useDocumentsQuery().data;
    const favorites = useFavoritesQuery(search).data;

    const [isAlertOpen, setIsAlertOpen] = useState(false);

    const isHidden = useIsElementHidden(element);

    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        element.elementType
    );

    if (isHidden || !data || !favorites) {
        return null;
    }

    const isFavorite = favorites.favorites[element.elementId] !== undefined;

    return (
        <ElementContextMenu element={element}>
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
                                setIsAlertOpen(true);
                                return;
                            }

                            navigate({
                                to: ".",
                                search: {
                                    activeMenu: AppMenu.INSERT_MENU,
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
                    <CannotDeriveAssemblyAlert
                        isOpen={isAlertOpen}
                        onClose={() => setIsAlertOpen(false)}
                    />
                    {ctxMenuProps.popover}
                </>
            )}
        </ElementContextMenu>
    );
}

interface ElementContextMenuProps {
    element: ElementObj;
    children: any;
}

export function ElementContextMenu(props: ElementContextMenuProps) {
    const { children, element } = props;

    const mutation = useSetVisibilityMutation(
        "set-visibility",
        [element.id],
        !element.isVisible
    );

    const menu = (
        <Menu>
            <OpenDocumentItem path={element} />
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
