import { Checkbox, Group } from "@mantine/core";
import { type ReactNode } from "react";
import { InfoTooltip } from "./info-tooltip";

interface InfoCheckboxProps {
    label: string;
    /** What ticking it does, behind the info icon. */
    info: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

/** A checkbox with its explanation beside it, where a click on the icon can't tick the box. */
export function InfoCheckbox(props: InfoCheckboxProps): ReactNode {
    const { label, info, checked, onChange } = props;
    return (
        <Group gap={6}>
            <Checkbox
                label={label}
                checked={checked}
                onChange={(event) => onChange(event.currentTarget.checked)}
            />
            <InfoTooltip label={info} />
        </Group>
    );
}
