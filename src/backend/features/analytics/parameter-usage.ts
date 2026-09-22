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

/** One value as it was recorded: what was chosen, and in which branch. */
export interface ValueCount {
    parameterId: string;
    value: string;
    /** See `toInstanceKeys`; empty for a parameter nothing conditions. */
    instanceKey: string;
    count: number;
}

/**
 * Merged with the parameters declared today, so an unused option still surfaces
 * and a retired one is dropped: nobody can pick it any more.
 *
 * One entry per instance rather than per parameter — a list another choice
 * filters is a different list under each — and each counts only the rows keyed
 * to a branch it covers. A row recorded before those keys were written belongs
 * to no branch, so it counts only where the parameter is reported whole; a
 * rebuild from the event log is what attributes the rest.
 */
export function buildParameterUsage(
    parameters: ConfigurationParameter[],
    valueRows: ValueCount[]
): ConfigurationParameterUsage[] {
    const rowsByParameter = Map.groupBy(valueRows, (row) => row.parameterId);

    return toParameterInstances(parameters).map((instance) => {
        const parameter = instance.parameter;
        const counts = countsFor(
            rowsByParameter.get(parameter.id),
            instance.keys
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
 * One parameter's counts by value, narrowed to the branches `keys` names. An
 * absent `keys` is a parameter reported whole, which every branch counts
 * towards — including the empty one older rows carry.
 */
function countsFor(
    rows: ValueCount[] | undefined,
    keys: string[] | undefined
): Map<string, number> {
    const wanted = keys === undefined ? undefined : new Set(keys);
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
        if (wanted && !wanted.has(row.instanceKey)) continue;
        counts.set(row.value, (counts.get(row.value) ?? 0) + row.count);
    }
    return counts;
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
