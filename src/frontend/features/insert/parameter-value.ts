import {
    type ConfigurationParameter,
    type Selection
} from "@backend/features/configurations/models";

/**
 * The selection one row's change produces, or the very same one when nothing
 * moves — which is what lets React stop.
 *
 * `undefined` means "the default", and a whole selection spells that out rather
 * than omitting it, so this compares the value it would write. Comparing
 * presence instead never settles: `toSelection` puts every parameter back on the
 * next render, so a hidden parameter's effect would write, be restored, and
 * write again for as long as the panel is open.
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
