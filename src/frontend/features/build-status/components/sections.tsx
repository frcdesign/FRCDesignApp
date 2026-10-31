import { Box, Group, Switch, Text } from "@mantine/core";
import { ReactNode } from "react";
import { StatusColor } from "../../../lib/style-constants";

interface ControlRowProps {
    label: string;
    description?: string;
    control: ReactNode;
}

/** Usually a Switch; an icon when the setting isn't the admin's to make. */
export function ControlRow(props: ControlRowProps): ReactNode {
    return (
        <Group justify="space-between" gap="md" align="center">
            <Box miw={0}>
                <Text>{props.label}</Text>
                {props.description && (
                    <Text size="xs" c={StatusColor.DIMMED}>
                        {props.description}
                    </Text>
                )}
            </Box>
            {props.control}
        </Group>
    );
}

interface SwitchRowProps {
    label: string;
    description?: string;
    checked: boolean;
    disabled?: boolean;
    onToggle: () => void;
}

export function SwitchRow(props: SwitchRowProps): ReactNode {
    return (
        <ControlRow
            label={props.label}
            description={props.description}
            control={
                <Switch
                    size="sm"
                    checked={props.checked}
                    disabled={props.disabled}
                    onChange={props.onToggle}
                    withThumbIndicator={false}
                />
            }
        />
    );
}
