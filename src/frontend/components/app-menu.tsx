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
    /**
     * Caps the dropdown to the room it has and scrolls it, for a list that can
     * outgrow the viewport. Only for a menu of plain items: Mantine renders
     * `Menu.Sub` inside its parent dropdown rather than in a portal, so a scroll
     * container here would hold a submenu inside the parent's box rather than
     * letting it open beside it.
     */
    scrollable?: boolean;
}

/**
 * A wrapper around Menu which displays a ContextMenu.
 */
export function AppContextMenu(props: AppContextMenuProps): ReactNode {
    const {
        menuItems,
        children,
        controlledByButton = false,
        wideMenu = false,
        scrollable = false
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
            // `size` caps the dropdown to the room Floating UI measures for it,
            // so a long list scrolls itself rather than running off the bottom.
            // Mantine's default flip/shift are spelled out because this replaces
            // the whole object rather than merging.
            middlewares={{ flip: true, shift: true, size: scrollable }}
        >
            {menuChildren}
            <Menu.Dropdown
                onClick={(event) => event.stopPropagation()}
                // `contain` keeps a scroll that reaches either end of the
                // dropdown from chaining to the list behind it, which otherwise
                // scrolls the app out from under the open menu.
                style={
                    scrollable
                        ? {
                              overflowY: "auto",
                              overscrollBehavior: "contain"
                          }
                        : undefined
                }
            >
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
