import { ReactNode } from "react";
import { FloatingPosition, Menu } from "@mantine/core";

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
