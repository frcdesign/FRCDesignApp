import { Alert, Button, Group, Text } from "@mantine/core";
import { InfoIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { IconSize, NO_SHRINK, StatusColor } from "../lib/style-constants";

/** What the note offers to do about itself. */
export interface CalloutAction {
    /** A verb or a destination, e.g. "Instructions". */
    text: string;
    onClick: () => void;
}

interface CalloutProps {
    text: string;
    /** Omitted for a note that only reports something. */
    action?: CalloutAction;
}

/**
 * A note above a list or a preview, saying something about what is under it.
 * The app's one shape for this, action included: a callout that builds its own
 * button is a callout that cannot be styled into a different thing per caller.
 *
 * Blue rather than the library accent, so it reads as a remark beside the
 * content rather than as part of it.
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
            <Group justify="space-between" wrap="nowrap" gap="sm">
                <Text size="sm">{text}</Text>
                {action && (
                    // Subtle and in the alert's own color, like the action on a
                    // toast: a filled or bordered button reads as a control
                    // dropped on the note rather than part of it. Held at its
                    // own width, since the text is what should give on a narrow
                    // row.
                    <Button
                        variant="subtle"
                        color={StatusColor.INFO}
                        size="compact-sm"
                        style={NO_SHRINK}
                        onClick={action.onClick}
                    >
                        {action.text}
                    </Button>
                )}
            </Group>
        </Alert>
    );
}
