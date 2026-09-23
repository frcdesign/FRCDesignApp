/**
 * Reads configuration data stored before selections kept what was entered.
 * Rows then held keys where they now hold values, and spelled quantities in
 * base units; a reload of the row's group rewrites it in the current shape, so
 * each of these can go once every library has been reloaded since.
 */
import {
    type ConfigurationParameter,
    type ConfigurationRecord,
    ParameterType,
    type Selection
} from "./contract";
import { canonicalValue, quantityDefault } from "./selection";
import { decodeConfiguration } from "./utils";
import { evaluateBaseValue, formatValueInUnit } from "./input-parser";

/** A record stored under the key of what it probed, rather than the values. */
interface LegacyRecord extends Omit<ConfigurationRecord, "values"> {
    configurationKey: string;
}

/**
 * A record's values. A legacy key named only enums and booleans, which it
 * spelled as entered, so decoding it gives the values back exactly.
 */
export function upgradeRecords(
    records: (ConfigurationRecord | LegacyRecord)[]
): ConfigurationRecord[] {
    return records.map((record) => {
        if ("values" in record) {
            return record;
        }
        const { configurationKey, ...rest } = record;
        return { ...rest, values: decodeConfiguration(configurationKey) };
    });
}

/** A quantity's default in its own unit, where it used to be in base units. */
export function upgradeParameters(
    parameters: ConfigurationParameter[]
): ConfigurationParameter[] {
    return parameters.map((parameter) =>
        parameter.type === ParameterType.QUANTITY
            ? { ...parameter, default: quantityDefault(parameter) }
            : parameter
    );
}

/**
 * A stored selection's quantities in their parameter's unit, where they were
 * saved in base units: "0.0508 m" reads back as "2 in". Only a value spelled
 * exactly as a base-unit value was is touched, so an expression somebody typed
 * is left as they typed it.
 */
export function upgradeSelection(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    const upgraded = { ...selection };
    for (const parameter of parameters) {
        const value = upgraded[parameter.id];
        if (
            parameter.type !== ParameterType.QUANTITY ||
            value === undefined ||
            canonicalValue(parameter, value) !== value
        ) {
            continue;
        }
        const base = evaluateBaseValue(
            value,
            parameter.quantityType,
            parameter.unit
        );
        if (base !== undefined) {
            upgraded[parameter.id] = formatValueInUnit(base, parameter.unit);
        }
    }
    return upgraded;
}
