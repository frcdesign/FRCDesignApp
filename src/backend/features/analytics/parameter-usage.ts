/**
 * What a part's recorded configuration values say, merged with the parameters
 * it declares today.
 */
import {
    ParameterType,
    type ConfigurationParameter
} from "../configurations/models";
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
 */
export function buildParameterUsage(
    parameters: ConfigurationParameter[],
    valueRows: { parameterId: string; value: string; count: number }[]
): ConfigurationParameterUsage[] {
    const countsByParameter = new Map<string, Map<string, number>>();
    for (const row of valueRows) {
        const values =
            countsByParameter.get(row.parameterId) ?? new Map<string, number>();
        values.set(row.value, row.count);
        countsByParameter.set(row.parameterId, values);
    }

    return parameters.map((parameter) => {
        const counts =
            countsByParameter.get(parameter.id) ?? new Map<string, number>();

        const values =
            parameter.type === ParameterType.ENUM
                ? // Seed from the declared options so a never-picked one is visible.
                  parameter.options.map((option) => ({
                      value: option.id,
                      label: option.name,
                      count: counts.get(option.id) ?? 0,
                      isDefault: option.id === parameter.default
                  }))
                : toFreeFormValues(counts, parameter, parameter.default);

        return {
            parameterId: parameter.id,
            name: parameter.name,
            type: parameter.type,
            defaultValue: parameter.default,
            total: sumCounts(counts),
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
