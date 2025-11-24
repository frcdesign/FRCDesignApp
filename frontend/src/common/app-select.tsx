import { Button, FormGroup, Intent, MenuItem } from "@blueprintjs/core";
import { ItemRenderer, Select } from "@blueprintjs/select";
import { Dispatch, ReactNode, useCallback } from "react";
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

    // const [activeShouldBeItem, setActiveShouldBeItem] =
    //     useState<boolean>(false);

    // const [activeOption, setActiveOption] = useState<SelectOption | null>(null);

    const renderOption: ItemRenderer<SelectOption> = useCallback(
        (currentOption, { handleClick, handleFocus, modifiers, ref }) => {
            const selected = option.value == currentOption.value;
            return (
                <MenuItem
                    key={currentOption.value}
                    ref={ref}
                    onClick={handleClick}
                    onFocus={handleFocus}
                    active={modifiers.active}
                    text={currentOption.label}
                    roleStructure="listoption"
                    selected={selected}
                    intent={selected ? Intent.PRIMARY : Intent.NONE}
                />
            );
        },
        [option]
    );

    // const handleActiveItemChange = useCallback(
    //     (newActiveOption: SelectOption | null) => {
    //         console.log("Set active: " + newActiveOption?.value);
    //         setActiveOption(newActiveOption);
    //     },
    //     []
    // );

    const select = (
        <Select<SelectOption>
            items={options}
            activeItem={option}
            filterable={false}
            popoverProps={{ minimal: true }}
            itemRenderer={renderOption}
            onItemSelect={(newItem) => {
                onSelect(newItem.value);
            }}
            itemsEqual={(lhs: SelectOption, rhs: SelectOption) =>
                lhs.value == rhs.value
            }
        >
            <Button
                alignText="start"
                endIcon="caret-down"
                text={option.label}
            />
        </Select>
    );

    return (
        <FormGroup label={label} className="full-width" inline>
            {select}
        </FormGroup>
    );
}
