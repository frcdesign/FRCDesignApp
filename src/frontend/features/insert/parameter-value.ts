import {
    type ConfigurationParameter,
    type Selection
} from "@backend/features/configurations/models";

/**
 * The selection a row's change produces, or the same one when nothing moves,
 * which is what lets React stop. Compares the value: presence never settles.
 */
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
