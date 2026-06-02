import { Box, Divider, Group, Menu, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import {
    createContext,
    MouseEvent as ReactMouseEvent,
    ReactNode,
    use
} from "react";

interface AppMenuContextValue {
    /** Dismisses the entire context menu. */
    close: () => void;
}

const AppMenuContext = createContext<AppMenuContextValue>({
    close: () => undefined
});

interface AppMenuProps {
    /** Provided by mantine-contextmenu's custom content render function. */
    close: () => void;
    children: ReactNode;
}

/**
 * The root of a custom context menu. Rendered inside mantine-contextmenu's
 * styled surface; provides the `close` callback to every descendant item.
 */
export function AppMenu({ close, children }: AppMenuProps): ReactNode {
    return (
        <AppMenuContext value={{ close }}>
            <Stack gap={0} miw={180}>
                {children}
            </Stack>
        </AppMenuContext>
    );
}

interface AppMenuItemProps {
    icon?: ReactNode;
    /** A Mantine color name (e.g. "red") applied to the label and icon. */
    color?: string;
    disabled?: boolean;
    onClick?: (event: ReactMouseEvent) => void;
    /** When true, clicking does not auto-dismiss the menu. */
    keepOpen?: boolean;
    children: ReactNode;
}

/**
 * A single context-menu row. Runs its handler and then closes the menu.
 */
export function AppMenuItem(props: AppMenuItemProps): ReactNode {
    const { close } = use(AppMenuContext);
    const { icon, color, disabled, onClick, keepOpen, children } = props;
    return (
        <UnstyledButton
            component="div"
            role="menuitem"
            className="app-menu-item"
            data-disabled={disabled || undefined}
            c={color}
            onClick={(event: ReactMouseEvent) => {
                if (disabled) {
                    return;
                }
                onClick?.(event);
                if (!keepOpen) {
                    close();
                }
            }}
        >
            <Group gap="sm" wrap="nowrap">
                {icon && (
                    <Box className="app-menu-item-icon" c={color}>
                        {icon}
                    </Box>
                )}
                <Text size="sm" className="app-menu-item-label">
                    {children}
                </Text>
            </Group>
        </UnstyledButton>
    );
}

export function AppMenuDivider(): ReactNode {
    return <Divider className="app-menu-divider" />;
}

interface AppSubmenuProps {
    title: string;
    icon?: ReactNode;
    children: ReactNode;
}

/**
 * A nested submenu rendered as a hover-triggered flyout to the right.
 */
export function AppSubmenu({
    title,
    icon,
    children
}: AppSubmenuProps): ReactNode {
    const { close } = use(AppMenuContext);
    return (
        <Menu
            trigger="hover"
            position="right-start"
            offset={4}
            withinPortal
            closeOnItemClick={false}
            zIndex={10000}
        >
            <Menu.Target>
                <UnstyledButton
                    component="div"
                    role="menuitem"
                    className="app-menu-item"
                >
                    <Group gap="sm" wrap="nowrap" justify="space-between">
                        <Group gap="sm" wrap="nowrap">
                            {icon && (
                                <Box className="app-menu-item-icon">{icon}</Box>
                            )}
                            <Text size="sm">{title}</Text>
                        </Group>
                        <IconChevronRight size={14} />
                    </Group>
                </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
                <AppMenuContext value={{ close }}>
                    <Stack gap={0} miw={180}>
                        {children}
                    </Stack>
                </AppMenuContext>
            </Menu.Dropdown>
        </Menu>
    );
}
