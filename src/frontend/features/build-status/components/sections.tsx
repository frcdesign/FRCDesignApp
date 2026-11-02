import { Switch } from "@mantine/core";
import { ReactNode } from "react";
import { HoverBubbleRow } from "../../../components/app-hover-bubble";

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
        <HoverBubbleRow label={label} description={description}>
            <RowSwitch {...control} />
        </HoverBubbleRow>
    );
}
