import { Group, Text } from "@mantine/core";
import { type ReactNode } from "react";
import { INPUT_HEIGHT } from "../lib/style-constants";

interface InputRowProps {
    label: string;
    /** The id of the control the label describes, so clicking it focuses. */
    htmlFor?: string;
    /** True to lead with the control: a checkbox reads before its label. */
    controlFirst?: boolean;
    /**
     * True to push the control to the far end, which a menu of differently
     * shaped controls wants and a form of same-width inputs does not.
     */
    spread?: boolean;
    children: ReactNode;
}

/**
 * A label beside its control rather than above it. Given the control's height
 * so the row stays level when an input grows to show an error.
 */
export function InputRow({
    label,
    htmlFor,
    controlFirst = false,
    spread = false,
    children
}: InputRowProps): ReactNode {
    const text = (
        <Text
            size="sm"
            display="flex"
            h={INPUT_HEIGHT}
            style={{ alignItems: "center", cursor: "pointer" }}
            component="label"
            htmlFor={htmlFor}
        >
            {label}
        </Text>
    );

    return (
        <Group
            gap="sm"
            wrap="nowrap"
            align="flex-start"
            justify={spread ? "space-between" : undefined}
        >
            {controlFirst ? children : text}
            {controlFirst ? text : children}
        </Group>
    );
}
