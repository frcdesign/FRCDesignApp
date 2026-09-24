import { Box, Group, Text } from "@mantine/core";
import { ReactNode } from "react";
import { FontWeight, StatusColor } from "../../../lib/style-constants";

interface SectionHeaderProps {
    children: ReactNode;
}

/** A dimmed section header, e.g. "Admin" or "Parsed". */
export function SectionHeader(props: SectionHeaderProps): ReactNode {
    const { children } = props;
    return (
        <Text size="xs" fw={FontWeight.SEMI_BOLD} c={StatusColor.DIMMED}>
            {children}
        </Text>
    );
}

interface ControlRowProps {
    label: string;
    description?: string;
    control: ReactNode;
}

/** Usually a Switch; an icon when the setting isn't the admin's to make. */
export function ControlRow(props: ControlRowProps): ReactNode {
    return (
        <Group justify="space-between" wrap="nowrap" gap="md" align="center">
            <Box miw={0}>
                <Text size="sm">{props.label}</Text>
                <Text size="xs" c={StatusColor.DIMMED}>
                    {props.description}
                </Text>
            </Box>
            {props.control}
        </Group>
    );
}
