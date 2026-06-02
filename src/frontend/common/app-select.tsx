import { Select } from "@mantine/core";
import { Dispatch, ReactNode } from "react";
import { SelectOption } from "./select-utils";

interface AppSelectProps {
    option: SelectOption;
    /**
     * A list of options to choose from.
     * Should be wrapped in a useMemo to ensure stability.
     */
    options: SelectOption[];
    label: string;
    onSelect: Dispatch<string>;
}

export function AppSelect(props: AppSelectProps): ReactNode {
    const { option, options, onSelect, label } = props;

    return (
        <Select
            className="full-width"
            label={label}
            data={options}
            value={option.value}
            allowDeselect={false}
            checkIconPosition="right"
            comboboxProps={{ withinPortal: true }}
            onChange={(value) => {
                if (value !== null) {
                    onSelect(value);
                }
            }}
        />
    );
}
