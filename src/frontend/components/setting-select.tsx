import { Select } from "@mantine/core";
import { ReactNode, useId } from "react";
import { SETTING_CONTROL_WIDTH } from "../lib/style-constants";
import { InputRow } from "./input-row";

interface SettingSelectProps<T extends string> {
    label: string;
    value: T;
    /** In the order given. */
    options: T[];
    optionLabel: (option: T) => string;
    onSelect: (value: T) => void;
}

/** A setting chosen from a short list of named values. */
export function SettingSelect<T extends string>(
    props: SettingSelectProps<T>
): ReactNode {
    const { label, value, options, optionLabel, onSelect } = props;
    const id = useId();

    return (
        <InputRow label={label} htmlFor={id}>
            <Select
                id={id}
                w={SETTING_CONTROL_WIDTH}
                data={options.map((option) => ({
                    value: option,
                    label: optionLabel(option)
                }))}
                value={value}
                allowDeselect={false}
                checkIconPosition="right"
                onChange={(selected) => {
                    if (selected !== null) {
                        onSelect(selected);
                    }
                }}
            />
        </InputRow>
    );
}
