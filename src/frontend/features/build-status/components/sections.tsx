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

interface RowSwitchProps {
    checked: boolean;
    disabled?: boolean;
    onToggle: () => void;
}

/** The switch every row in the card draws. */
export function RowSwitch(props: RowSwitchProps): ReactNode {
    return (
        <Switch
            size="sm"
            checked={props.checked}
            disabled={props.disabled}
            onChange={props.onToggle}
            withThumbIndicator={false}
        />
    );
}

interface SwitchRowProps extends RowSwitchProps {
    label: string;
    description?: string;
}

export function SwitchRow(props: SwitchRowProps): ReactNode {
    const { label, description, ...control } = props;
    return (
        <ControlRow
            label={label}
            description={description}
            control={<RowSwitch {...control} />}
        />
    );
}
