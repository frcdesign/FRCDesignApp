/**
 * What a part's recorded configuration values say, merged with the parameters
 * it declares today — once per way each parameter is shown.
 */
import {
    ParameterType,
    type ConfigurationParameter
} from "../configurations/contract";
import { toParameterInstances } from "../configurations/instances";
import { formatValue } from "../configurations/selection";
import type {
    ConfigurationParameterUsage,
    ConfigurationValueUsage
} from "./contract";

/** Values shown per free-form (non-enum) parameter before truncating. */
const MAX_FREE_FORM_VALUES = 20;

/**
 * Merged with the parameters declared today, so an unused option still surfaces
 * and a retired one is dropped: nobody can pick it any more.
 *
 * One entry per instance rather than per parameter — a list another choice
 * filters is a different list under each. The rollup counts a value without
 * recording what else was chosen alongside it, so an option two branches both
 * offer is counted in both; an option only one branch offers, which is what
 * conditioning options is usually for, is counted exactly once.
 */
export function buildParameterUsage(
    parameters: ConfigurationParameter[],
    valueRows: { parameterId: string; value: string; count: number }[]
): ConfigurationParameterUsage[] {
    const rowsByParameter = Map.groupBy(valueRows, (row) => row.parameterId);

    return toParameterInstances(parameters).map((instance) => {
        const parameter = instance.parameter;
        // `new Map(undefined)` is empty, which is what a parameter nobody has
        // configured should read as.
        const counts = new Map(
            rowsByParameter
                .get(parameter.id)
                ?.map((row) => [row.value, row.count] as const)
        );

        const isEnum = parameter.type === ParameterType.ENUM;
        const values = isEnum
            ? // Seeded from the options this instance offers, so a never-picked
              // one is visible and one it does not offer is not listed here.
              instance.options.map((option) => ({
                  value: option.id,
                  label: option.name,
                  count: counts.get(option.id) ?? 0,
                  isDefault: option.id === parameter.default,
                  ...(option.id === instance.implicitDefaultId && {
                      isImplicitDefault: true
                  })
              }))
            : toFreeFormValues(counts, parameter, parameter.default);

        return {
            parameterId: parameter.id,
            name: parameter.name,
            type: parameter.type,
            defaultValue: parameter.default,
            path: instance.path.map((step) => step.label),
            // An instance's own options, so its percentages add to a hundred;
            // a free-form list is truncated, so its total stays the true one.
            total: isEnum ? sumValues(values) : sumCounts(counts),
            values: values.sort((a, b) => b.count - a.count)
        };
    });
}

/**
 * Unbounded distinct values, so only the most-used are returned, plus the
 * default. Labelled in the parameter's unit; nobody reads a tube length in metres.
 */
function toFreeFormValues(
    counts: Map<string, number>,
    parameter: ConfigurationParameter,
    defaultValue: string
): ConfigurationValueUsage[] {
    const top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_FREE_FORM_VALUES)
        .map(([value, count]) => ({
            value,
            label: formatValue(parameter, value),
            count,
            isDefault: value === defaultValue
        }));

    if (!top.some((entry) => entry.isDefault)) {
        top.push({
            value: defaultValue,
            label: formatValue(parameter, defaultValue),
            count: counts.get(defaultValue) ?? 0,
            isDefault: true
        });
    }
    return top;
}

function sumCounts(counts: Map<string, number>): number {
    let total = 0;
    for (const value of counts.values()) total += value;
    return total;
}

function sumValues(values: ConfigurationValueUsage[]): number {
    return values.reduce((total, value) => total + value.count, 0);
}
