import {
    type ConfigurationParameter,
    type Selection
} from "@backend/features/configurations/contract";

/** Returns the same selection when nothing changes, so React can bail out. */
export function withParameterValue(
    selection: Selection,
    parameter: ConfigurationParameter,
    newValue: string | undefined
): Selection {
    const wanted = newValue ?? parameter.default;
    if (selection[parameter.id] === wanted) {
        return selection;
    }
    return { ...selection, [parameter.id]: wanted };
}
