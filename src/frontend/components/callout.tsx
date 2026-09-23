import { Alert, Button, Group, Text } from "@mantine/core";
import { InfoIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { IconSize, StatusColor } from "../lib/style-constants";

interface CalloutAction {
    /** A verb or a destination, e.g. "Instructions". */
    text: string;
    icon: ReactNode;
    onClick: () => void;
}

interface CalloutProps {
    /** A whole sentence, ending in a period. */
    text: string;
    /** Omitted for a note that only reports something. */
    action?: CalloutAction;
}

/**
 * A note above a list or a preview, saying something about what is under it. It
 * builds its own button, so no caller can style one of its own. Blue rather
 * than the library accent, so it reads as a remark beside the content.
 */
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
            <Group justify="space-between" gap="xs">
                <Text size="sm" flex="1 1 12rem">
                    {text}
                </Text>
                {action && (
                    // Outlined rather than filled, which would shout on a note.
                    <Button
                        variant="outline"
                        color={StatusColor.INFO}
                        size="compact-sm"
                        leftSection={action.icon}
                        onClick={action.onClick}
                    >
                        {action.text}
                    </Button>
                )}
            </Group>
        </Alert>
    );
}
