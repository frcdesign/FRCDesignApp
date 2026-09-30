import { Alert, Button, Group, Loader, Text } from "@mantine/core";
import { InfoIcon, type Icon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { IconSize, StatusColor } from "../lib/style-constants";
import { AppIcon } from "./app-icon";

interface CalloutProps {
    /** A whole sentence, ending in a period. */
    text: string;
    /** A `CalloutButton`; omitted for a note that only reports something. */
    action?: ReactNode;
    /** @default StatusColor.INFO */
    color?: StatusColor;
    /** Drawn filled, in the callout's color. @default InfoIcon */
    icon?: Icon;
    /** A spinner in place of the icon, for something still going. */
    loading?: boolean;
}

/**
 * Blue by default, so it reads as a remark rather than library content; a
 * status color for one reporting how something went. Icon and text both take
 * the color, over a faint wash of it: Mantine's dark-mode tint is a solid
 * shade, and its text on it all but white.
 */
export function Callout(props: CalloutProps): ReactNode {
    const {
        text,
        action,
        color = StatusColor.INFO,
        icon = InfoIcon,
        loading = false
    } = props;
    const background = `light-dark(var(--mantine-color-${color}-light), color-mix(in srgb, var(--mantine-color-${color}-filled) 20%, transparent))`;
    const foreground = `light-dark(var(--mantine-color-${color}-light-color), var(--mantine-color-${color}-4))`;

    return (
        <Alert
            color={color}
            py="xs"
            px="sm"
            icon={
                loading ? (
                    <Loader size={IconSize.MEDIUM} color="var(--alert-color)" />
                ) : (
                    <AppIcon icon={icon} size={IconSize.MEDIUM} weight="fill" />
                )
            }
            vars={() => ({
                root: { "--alert-bg": background, "--alert-color": foreground }
            })}
            styles={{
                body: { minWidth: 0 },
                wrapper: { alignItems: "center" }
            }}
        >
            {/* Wraps rather than squeezing: on a narrow panel the button drops
                under the text instead of running off the edge. */}
            <Group justify="space-between" gap="xs" wrap="wrap">
                <Text flex="1 1 12rem" c="var(--alert-color)">
                    {text}
                </Text>
                {action}
            </Group>
        </Alert>
    );
}

interface CalloutButtonProps {
    /** A verb or a destination, e.g. "Instructions". */
    children: string;
    icon: ReactNode;
    onClick: () => void;
    /** Matches the callout it sits in. @default StatusColor.INFO */
    color?: StatusColor;
}

export function CalloutButton(props: CalloutButtonProps): ReactNode {
    const { children, icon, onClick, color = StatusColor.INFO } = props;
    return (
        <Button
            variant="outline"
            color={color}
            size="compact-sm"
            leftSection={icon}
            onClick={onClick}
        >
            {children}
        </Button>
    );
}
