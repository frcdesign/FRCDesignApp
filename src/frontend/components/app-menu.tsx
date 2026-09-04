import { PropsWithChildren, ReactNode } from "react";
import { FloatingPosition, Menu, ActionIcon } from "@mantine/core";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { IconSize, StatusColor } from "../lib/style-constants";

interface AppContextMenuProps {
    menuItems: ReactNode;
    children: ReactNode;
    /**
     * Set to true if this ContextMenu is controlled by a button.
     * @default false
     */
    controlledByButton?: boolean;
    /**
     * Set to true to make the ContextMenu wider than normal.
     * @default false
     */
    wideMenu?: boolean;
}

/**
 * A wrapper around Menu which displays a ContextMenu.
 */
export function AppContextMenu(props: AppContextMenuProps): ReactNode {
    const {
        menuItems,
        children,
        controlledByButton = false,
        wideMenu = false
    } = props;

    let menuChildren: ReactNode;
    let position: FloatingPosition | undefined = undefined;
    if (controlledByButton) {
        position = "bottom-end";
        menuChildren = <Menu.Target>{children}</Menu.Target>;
    } else {
        menuChildren = <Menu.ContextMenu>{children}</Menu.ContextMenu>;
    }

    return (
        <Menu
            shadow="md"
            width={wideMenu ? 240 : 220}
            withinPortal
            clickOutsideEvents={[
                "mousedown",
                "touchstart",
                "keydown",
                "contextmenu"
            ]}
            position={position}
        >
            {menuChildren}
            <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
                {menuItems}
            </Menu.Dropdown>
        </Menu>
    );
}

/**
 * An explicit button which opens a menu with the given items. Used alongside
 * the right-click context menu so the menu is reachable without a right-click.
 */
interface MenuButtonProps extends PropsWithChildren {
    /**
     * Sizes the button to sit beside a full-height button rather than in a card row.
     * @default false
     */
    large?: boolean;
}

export function MenuButton(props: MenuButtonProps): ReactNode {
    const { large, children } = props;
    return (
        <AppContextMenu controlledByButton menuItems={children}>
            <ActionIcon
                variant="subtle"
                color={StatusColor.NEUTRAL}
                size={large ? "input-sm" : undefined}
                title="View options"
                onClick={(e) => e.stopPropagation()}
            >
                <DotsThreeIcon
                    size={large ? IconSize.CONTROL : IconSize.MEDIUM}
                />
            </ActionIcon>
        </AppContextMenu>
    );
}
