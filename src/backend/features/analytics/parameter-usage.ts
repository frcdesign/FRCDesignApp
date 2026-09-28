import {
    ParameterType,
    type ConfigurationParameter
} from "../configurations/contract";
import { toParameterInstances } from "../configurations/instances";
import { canonicalValue, formatValue } from "../configurations/selection";
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
 * Against today's parameters, so unused options show and retired ones drop.
 * One entry per instance, counting only the rows keyed to a branch it covers.
 * Rows from before keys were written count only where it is reported whole.
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
            : // Counted canonically, so the default is looked up that way too.
              toFreeFormValues(
                  counts,
                  parameter,
                  canonicalValue(parameter, parameter.default)
              );

        return {
            parameterId: parameter.id,
            name: parameter.name,
            type: parameter.type,
            defaultValue: parameter.default,
            path: instance.path.map((step) => step.label),
            // An enum's percentages add to 100; a free-form list is truncated, so it keeps the true total.
            total: isEnum ? sumValues(values) : sumCounts(counts),
            values: values.sort((a, b) => b.count - a.count)
        };
    });
}

/** Narrowed to the branches `keys` names; absent keys count every branch. */
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

/** The most-used values plus the default, in the parameter's unit. */
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
