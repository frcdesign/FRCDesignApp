import { Group, Text } from "@mantine/core";
import { type ReactNode } from "react";
import { INPUT_HEIGHT } from "../lib/style-constants";

interface InputRowProps {
    label: string;
    /** The id of the control the label describes, so clicking it focuses. */
    htmlFor?: string;
    children: ReactNode;
}

/** Given an input's height so rows stay level whatever the control. */
export function InputRow(props: InputRowProps): ReactNode {
    const { label, htmlFor, children } = props;
    return (
        <Group gap="sm" wrap="nowrap" justify="space-between">
            <Text
                size="sm"
                component="label"
                htmlFor={htmlFor}
                display="flex"
                h={INPUT_HEIGHT}
                style={{ alignItems: "center" }}
            >
                {label}
            </Text>
            {children}
        </Group>
    );
}
