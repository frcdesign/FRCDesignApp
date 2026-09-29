import { Alert, Button, Group, Text } from "@mantine/core";
import { InfoIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { IconSize, StatusColor } from "../lib/style-constants";

interface CalloutProps {
    /** A whole sentence, ending in a period. */
    text: string;
    /** A few words over the text, for a callout reporting on something. */
    title?: string;
    /** A `CalloutButton`; omitted for a note that only reports something. */
    action?: ReactNode;
    /** @default StatusColor.INFO */
    color?: StatusColor;
    /** @default an info icon */
    icon?: ReactNode;
    /** Gives it a close button, for a report somebody may be done with. */
    onClose?: () => void;
}

/**
 * Blue by default, so it reads as a remark rather than library content; a
 * status color for one reporting how something went.
 */
export function Callout(props: CalloutProps): ReactNode {
    const {
        text,
        title,
        action,
        color = StatusColor.INFO,
        icon = <InfoIcon size={IconSize.MEDIUM} />,
        onClose
    } = props;

    return (
        <Alert
            color={color}
            py="xs"
            px="sm"
            icon={icon}
            title={title}
            withCloseButton={onClose !== undefined}
            onClose={onClose}
            styles={{
                body: { minWidth: 0 },
                wrapper: { alignItems: title ? undefined : "center" }
            }}
        >
            {/* Wraps rather than squeezing: on a narrow panel the button drops
                under the text instead of running off the edge. */}
            <Group justify="space-between" gap="xs" wrap="wrap">
                <Text flex="1 1 12rem">{text}</Text>
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
