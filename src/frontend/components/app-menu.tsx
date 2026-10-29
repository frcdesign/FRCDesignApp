import { PropsWithChildren, ReactNode } from "react";
import { FloatingPosition, Menu, ActionIcon } from "@mantine/core";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { IconSize } from "../lib/style-constants";
import { RequireAccessLevel } from "../features/auth/components/require-access";
import classes from "./app-menu.module.css";
import { NewIndicator } from "./new-feature";

interface AppContextMenuProps {
    menuItems: ReactNode;
    children: ReactNode;
    controlledByButton?: boolean;
    wideMenu?: boolean;
    /** Caps the dropdown to the available room and scrolls it. */
    scrollable?: boolean;
    /** With `controlledByButton`: dots the button. Set, even false, it wraps the button. */
    isNew?: boolean;
    onClose?: () => void;
}

export function AppContextMenu(props: AppContextMenuProps): ReactNode {
    const {
        menuItems,
        children,
        controlledByButton = false,
        wideMenu = false,
        scrollable = false,
        isNew,
        onClose
    } = props;

    let menuChildren: ReactNode;
    let position: FloatingPosition | undefined = undefined;
    if (controlledByButton) {
        position = "bottom-end";
        menuChildren = <Menu.Target>{children}</Menu.Target>;
        // Outside the target: the button stops its clicks, so a wrapper inside would never open the menu.
        if (isNew !== undefined) {
            menuChildren = (
                <NewIndicator shown={isNew}>{menuChildren}</NewIndicator>
            );
        }
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
            onClose={onClose}
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
    /** Room for a long item to stay on one line. */
    wide?: boolean;
    /** Dots the button while the menu holds a new feature. */
    isNew?: boolean;
    onClose?: () => void;
}

export function MenuButton(props: MenuButtonProps): ReactNode {
    const { large, wide, isNew, onClose, children } = props;
    return (
        <AppContextMenu
            controlledByButton
            wideMenu={wide}
            menuItems={children}
            isNew={isNew}
            onClose={onClose}
        >
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
}

export function MenuSection(props: MenuSectionProps): ReactNode {
    const { label, children } = props;
    return (
        <>
            <Menu.Label>{label}</Menu.Label>
            {children}
        </>
    );
}

/** In place rather than in a submenu; the label marks them as admin. */
export function AdminMenuSection(props: PropsWithChildren): ReactNode {
    return (
        <RequireAccessLevel>
            <MenuSection label="Admin">{props.children}</MenuSection>
        </RequireAccessLevel>
    );
}
