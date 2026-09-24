import { Alert, Button, Group, Text } from "@mantine/core";
import { InfoIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { IconSize, StatusColor } from "../lib/style-constants";

interface CalloutProps {
    /** A whole sentence, ending in a period. */
    text: string;
    /** A `CalloutButton`; omitted for a note that only reports something. */
    action?: ReactNode;
}

/** Blue, so it reads as a remark rather than library content. */
export function Callout(props: CalloutProps): ReactNode {
    const { text, action } = props;

    return (
        <Alert
            color={StatusColor.INFO}
            py="xs"
            px="sm"
            icon={<InfoIcon size={IconSize.MEDIUM} />}
            styles={{
                body: { minWidth: 0 },
                wrapper: { alignItems: "center" }
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
}

export function CalloutButton(props: CalloutButtonProps): ReactNode {
    const { children, icon, onClick } = props;
    return (
        <Button
            variant="outline"
            color={StatusColor.INFO}
            size="compact-sm"
            leftSection={icon}
            onClick={onClick}
        >
            {children}
        </Button>
    );
}
