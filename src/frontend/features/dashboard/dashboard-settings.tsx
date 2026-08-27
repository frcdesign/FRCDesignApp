import {
    Menu,
    useMantineColorScheme,
    type MantineColorScheme
} from "@mantine/core";
import {
    Gear,
    Moon,
    Sun,
    Desktop,
    ChatCircleText
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { ActionIcon } from "@mantine/core";
import { IconSize } from "../../lib/style-constants";
import { FEEDBACK_FORM_URL, openUrlInNewTab } from "../../lib/url";

const SCHEMES: { value: MantineColorScheme; label: string; icon: ReactNode }[] =
    [
        {
            value: "auto",
            label: "System",
            icon: <Desktop size={IconSize.SMALL} />
        },
        { value: "light", label: "Light", icon: <Sun size={IconSize.SMALL} /> },
        { value: "dark", label: "Dark", icon: <Moon size={IconSize.SMALL} /> }
    ];

/**
 * The dashboard's settings.
 *
 * Deliberately not the panel's settings modal: this page is public, so the
 * app's theme and access settings are either unauthorized or write to a
 * session that does not exist here. Color scheme is the one that applies.
 */
export function DashboardSettingsMenu(): ReactNode {
    const { colorScheme, setColorScheme } = useMantineColorScheme();

    return (
        <Menu position="bottom-end" withinPortal>
            <Menu.Target>
                <ActionIcon
                    my="auto"
                    variant="subtle"
                    color="gray"
                    aria-label="Settings"
                >
                    <Gear size={IconSize.MEDIUM} />
                </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>Theme</Menu.Label>
                {SCHEMES.map((scheme) => (
                    <Menu.Item
                        key={scheme.value}
                        leftSection={scheme.icon}
                        disabled={colorScheme === scheme.value}
                        onClick={() => setColorScheme(scheme.value)}
                    >
                        {scheme.label}
                    </Menu.Item>
                ))}
                <Menu.Divider />
                <Menu.Item
                    leftSection={<ChatCircleText size={IconSize.SMALL} />}
                    onClick={() => openUrlInNewTab(FEEDBACK_FORM_URL)}
                >
                    Submit feedback
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    );
}
