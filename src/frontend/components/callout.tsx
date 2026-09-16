import { Alert, Box, Group, Text } from "@mantine/core";
import { InfoIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { IconSize, NO_SHRINK, StatusColor } from "../lib/style-constants";

interface CalloutProps {
    text: string;
    action: ReactNode;
}

/**
 * A strip of note above a list or a preview, saying something about what is
 * under it. Blue rather than the library accent: it reads as a remark beside
 * the content rather than as part of it.
 */
export function Callout(props: CalloutProps): ReactNode {
    return (
        <Alert
            color={StatusColor.INFO}
            p="xs"
            icon={<InfoIcon size={IconSize.MEDIUM} />}
            styles={{ body: { minWidth: 0 } }}
        >
            <Group justify="space-between" wrap="nowrap" gap="sm">
                <Text size="sm">{props.text}</Text>
                {/* The text is what gives on a narrow row; an action squeezed
                    to fit loses the end of its label. */}
                <Box style={NO_SHRINK}>{props.action}</Box>
            </Group>
        </Alert>
    );
}
