import { Box, Group, Switch, Text } from "@mantine/core";
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
    /** Neither on nor off, until somebody decides; the thumb sits in the middle. */
    indeterminate?: boolean;
    disabled?: boolean;
    onToggle: () => void;
}

const INDETERMINATE_STYLES = {
    thumb: {
        "--switch-thumb-start": "calc(50% - var(--switch-thumb-size) / 2)"
    },
    track: { borderColor: "var(--mantine-color-yellow-filled)" }
};

export function SwitchRow(props: SwitchRowProps): ReactNode {
    return (
        <ControlRow
            label={props.label}
            description={props.description}
            control={
                <Switch
                    size="sm"
                    checked={props.checked && !props.indeterminate}
                    styles={
                        props.indeterminate ? INDETERMINATE_STYLES : undefined
                    }
                    disabled={props.disabled}
                    onChange={props.onToggle}
                    withThumbIndicator={false}
                />
            }
        />
    );
}
