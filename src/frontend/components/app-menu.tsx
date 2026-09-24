import { PropsWithChildren, ReactNode } from "react";
import { FloatingPosition, Menu, ActionIcon } from "@mantine/core";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { IconSize, StatusColor } from "../lib/style-constants";
import { RequireAccessLevel } from "../features/auth/access-level";
import classes from "./app-menu.module.css";

interface AppContextMenuProps {
    menuItems: ReactNode;
    children: ReactNode;
    controlledByButton?: boolean;
    wideMenu?: boolean;
    /** Caps the dropdown to the available room and scrolls it. */
    scrollable?: boolean;
}

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
            width={wideMenu ? 240 : 220}
            clickOutsideEvents={[
                "mousedown",
                "touchstart",
                "keydown",
                "contextmenu"
            ]}
            position={position}
            middlewares={{ size: scrollable }}
        >
            {menuChildren}
            <Menu.Dropdown
                onClick={(event) => event.stopPropagation()}
                className={scrollable ? classes.scrollable : undefined}
            >
                {menuItems}
            </Menu.Dropdown>
        </Menu>
    );
}

/** So the menu is reachable without a right-click. */
interface MenuButtonProps extends PropsWithChildren {
    /** Sizes the button to sit beside a full-height button, not in a card row. */
    large?: boolean;
}

export function MenuButton(props: MenuButtonProps): ReactNode {
    const { large, children } = props;
    return (
        <AppContextMenu controlledByButton menuItems={children}>
            <ActionIcon
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
    /** Colors the label, for a section only some callers see. */
    color?: StatusColor;
}

export function MenuSection(props: MenuSectionProps): ReactNode {
    const { label, color, children } = props;
    return (
        <>
            <Menu.Label c={color}>{label}</Menu.Label>
            {children}
        </>
    );
}

/** In place rather than in a submenu; the label marks them as admin. */
export function AdminMenuSection(props: PropsWithChildren): ReactNode {
    return (
        <RequireAccessLevel>
            <MenuSection label="Admin" color={StatusColor.WARNING}>
                {props.children}
            </MenuSection>
        </RequireAccessLevel>
    );
}
