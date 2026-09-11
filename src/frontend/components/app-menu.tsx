import { PropsWithChildren, ReactNode } from "react";
import { FloatingPosition, Menu, ActionIcon } from "@mantine/core";
import { DotsThreeIcon, GearIcon } from "@phosphor-icons/react";
import { IconSize, StatusColor } from "../lib/style-constants";
import { RequireAccessLevel } from "../features/auth/access-level";

interface AppContextMenuProps {
    menuItems: ReactNode;
    children: ReactNode;
    /** Set when a button owns the menu, rather than a right-click on a row. */
    controlledByButton?: boolean;
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
    /** Sizes the button to sit beside a full-height button, not in a card row. */
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

/** Wraps one or more admin-only menu items into an Admin submenu. */
export function AdminOptionsSubmenu(props: PropsWithChildren): ReactNode {
    return (
        <RequireAccessLevel>
            <Menu.Divider />
            <Menu.Sub>
                <Menu.Sub.Target>
                    <Menu.Sub.Item
                        color={StatusColor.WARNING}
                        leftSection={<GearIcon size={IconSize.SMALL} />}
                    >
                        Admin options
                    </Menu.Sub.Item>
                </Menu.Sub.Target>
                <Menu.Sub.Dropdown>{props.children}</Menu.Sub.Dropdown>
            </Menu.Sub>
        </RequireAccessLevel>
    );
}
