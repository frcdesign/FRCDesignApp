import {
    type EnumOption,
    type OptionVisibilityCondition,
    OptionVisibilityType,
    type ConfigurationParameter,
    ParameterType,
    type VisibilityCondition,
    VisibilityType
} from "../configurations/contract";
import { quantityDefault } from "../configurations/selection";
import {
    type OnshapeConfigurationResponse,
    type OnshapeEnumOptionVisibilityConditionList,
    OnshapeOptionVisibilityConditionType,
    OnshapeParameterType,
    type OnshapeVisibilityCondition,
    OnshapeVisibilityConditionType
} from "../../lib/onshape/types";

function parseVisibilityCondition(
    onshapeCondition: OnshapeVisibilityCondition | undefined
): VisibilityCondition | undefined {
    if (!onshapeCondition) return undefined;
    if (onshapeCondition.btType === OnshapeVisibilityConditionType.NONE) {
        return undefined;
    }

    if (onshapeCondition.btType === OnshapeVisibilityConditionType.LOGICAL) {
        const children = onshapeCondition.children
            .map((child) => parseVisibilityCondition(child))
            .filter(
                (condition): condition is VisibilityCondition => !!condition
            );

        // Nothing left that says when to show the parameter, so it is not a
        // condition: stored as one, an OR of nothing would read as never.
        if (children.length === 0) {
            return undefined;
        }

        return {
            type: VisibilityType.LOGICAL,
            operation: onshapeCondition.operation,
            children
        };
    } else if (
        onshapeCondition.btType === OnshapeVisibilityConditionType.EQUAL
    ) {
        return {
            type: VisibilityType.EQUAL,
            id: onshapeCondition.parameterId,
            value: onshapeCondition.value
        };
    } else if (
        onshapeCondition.btType === OnshapeVisibilityConditionType.RANGE
    ) {
        const optionRange = onshapeCondition.optionRange;
        return {
            type: VisibilityType.RANGE,
            id: onshapeCondition.parameterId,
            start: optionRange.start,
            end: optionRange.end
        };
    } else if (
        onshapeCondition.btType === OnshapeVisibilityConditionType.ALWAYS_SHOWN
    ) {
        return { type: VisibilityType.ALWAYS_SHOWN };
    }

    return undefined;
}

function parseOptionVisibilityConditions(
    onshapeOptionConditions:
        | OnshapeEnumOptionVisibilityConditionList
        | undefined
): OptionVisibilityCondition[] {
    if (!onshapeOptionConditions) return [];

    return onshapeOptionConditions.visibilityConditions
        .map((onshapeOptionCondition): OptionVisibilityCondition | null => {
            const condition = parseVisibilityCondition(
                onshapeOptionCondition.condition
            );

            if (!condition) return null;

            if (
                onshapeOptionCondition.btType ===
                OnshapeOptionVisibilityConditionType.LIST
            ) {
                return {
                    type: OptionVisibilityType.LIST,
                    controlledOptions: onshapeOptionCondition.controlledOptions,
                    condition
                };
            } else if (
                onshapeOptionCondition.btType ===
                OnshapeOptionVisibilityConditionType.RANGE
            ) {
                const range = onshapeOptionCondition.controlledRange;
                return {
                    type: OptionVisibilityType.RANGE,
                    start: range.start,
                    end: range.end,
                    condition
                };
            }
            return null;
        })
        .filter(
            (condition): condition is OptionVisibilityCondition => !!condition
        );
}

export function parseOnshapeConfiguration(
    onshapeConfiguration: OnshapeConfigurationResponse
): ConfigurationParameter[] {
    const parameters: ConfigurationParameter[] = [];

    for (const parameter of onshapeConfiguration.configurationParameters) {
        const base = {
            id: parameter.parameterId,
            name: parameter.parameterName,
            isCosmetic: parameter.isCosmetic,
            condition: parseVisibilityCondition(parameter.visibilityCondition)
        };

        if (parameter.btType === OnshapeParameterType.ENUM) {
            const options: EnumOption[] = parameter.options.map((opt) => ({
                id: opt.option,
                name: opt.optionName
            }));
            parameters.push({
                ...base,
                type: ParameterType.ENUM,
                default: parameter.defaultValue,
                options,
                optionConditions: parseOptionVisibilityConditions(
                    parameter.enumOptionVisibilityConditions
                )
            });
        } else if (parameter.btType === OnshapeParameterType.BOOLEAN) {
            parameters.push({
                ...base,
                type: ParameterType.BOOLEAN,
                default: String(parameter.defaultValue).toLowerCase()
            });
        } else if (parameter.btType === OnshapeParameterType.STRING) {
            parameters.push({
                ...base,
                type: ParameterType.STRING,
                default: parameter.defaultValue
            });
        } else if (parameter.btType === OnshapeParameterType.QUANTITY) {
            const range = parameter.rangeAndDefault;
            const quantity = {
                ...base,
                type: ParameterType.QUANTITY as const,
                quantityType: parameter.quantityType,
                defaultValue: range.defaultValue,
                min: range.minValue,
                max: range.maxValue,
                unit: range.units
            };
            parameters.push({
                ...quantity,
                default: quantityDefault(quantity)
            });
        }
    }

    return parameters;
}
