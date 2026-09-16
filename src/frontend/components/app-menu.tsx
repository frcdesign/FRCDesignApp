import { PropsWithChildren, ReactNode } from "react";
import { FloatingPosition, Menu, ActionIcon } from "@mantine/core";
import { DotsThreeIcon } from "@phosphor-icons/react";
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
     * outgrow the viewport.
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

interface MenuSectionProps extends PropsWithChildren {
    /** What the items under it are for, e.g. "Insert". */
    label: string;
    /** Colors the label, for a section not everyone is shown. */
    color?: StatusColor;
}

/**
 * A run of menu items under a label naming them. Every item in a menu belongs
 * to one, so a dropdown reads as a few short lists rather than one long one.
 */
export function MenuSection(props: MenuSectionProps): ReactNode {
    const { label, color, children } = props;
    return (
        <>
            <Menu.Label c={color}>{label}</Menu.Label>
            {children}
        </>
    );
}

/**
 * The admin-only items of a menu, listed in place rather than behind a submenu:
 * one hover less to reach them, and the label is what marks them as admin.
 */
export function AdminMenuSection(props: PropsWithChildren): ReactNode {
    return (
        <RequireAccessLevel>
            <MenuSection label="Admin" color={StatusColor.WARNING}>
                {props.children}
            </MenuSection>
        </RequireAccessLevel>
    );
}
