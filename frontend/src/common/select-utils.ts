import { useMemo } from "react";

export interface SelectOption {
    value: string;
    label: string;
}

export function makeSelectOption(
    value: string,
    labelFunction: (value: string) => string
): SelectOption {
    return {
        value,
        label: labelFunction(value)
    };
}

export function makeSelectOptions(
    values: string[],
    labelFunction: (value: string) => string
): SelectOption[] {
    return values.map((value) => makeSelectOption(value, labelFunction));
}

export function useSelectOptions(
    values: string[],
    labelFunction: (value: string) => string
): SelectOption[] {
    return useMemo(
        () => makeSelectOptions(values, labelFunction),
        [values, labelFunction]
    );
}
