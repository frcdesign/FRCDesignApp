import {
    ConfigurationParameterType,
    EnumOption,
    OptionVisibilityCondition,
    OptionVisibilityConditionType,
    ParameterObj,
    VisibilityCondition,
    VisibilityConditionType,
    getUnitDisplayStr
} from "../../shared/configuration-models";
import {
    OnshapeConfigurationResponse,
    OnshapeEnumOptionVisibilityConditionList,
    OnshapeVisibilityCondition
} from "../onshape-api/onshape-types";

const VISIBILITY_CONDITION_NONE = "BTParameterVisibilityCondition-177";

function parseVisibilityCondition(
    onshapeCondition: OnshapeVisibilityCondition | undefined
): VisibilityCondition | undefined {
    if (!onshapeCondition) return undefined;
    if (onshapeCondition.btType === VISIBILITY_CONDITION_NONE) return undefined;

    if (onshapeCondition.btType === VisibilityConditionType.LOGICAL) {
        const children = onshapeCondition.children
            .map((child) => parseVisibilityCondition(child))
            .filter(
                (condition): condition is VisibilityCondition => !!condition
            );

        return {
            type: VisibilityConditionType.LOGICAL,
            operation: onshapeCondition.operation,
            children
        };
    } else if (onshapeCondition.btType === VisibilityConditionType.EQUAL) {
        return {
            type: VisibilityConditionType.EQUAL,
            id: onshapeCondition.parameterId,
            value: onshapeCondition.value
        };
    } else if (onshapeCondition.btType === VisibilityConditionType.RANGE) {
        const optionRange = onshapeCondition.optionRange;
        return {
            type: VisibilityConditionType.RANGE,
            id: onshapeCondition.parameterId,
            start: optionRange.start,
            end: optionRange.end
        };
    } else if (
        onshapeCondition.btType === VisibilityConditionType.ALWAYS_SHOWN
    ) {
        return { type: VisibilityConditionType.ALWAYS_SHOWN };
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
                OptionVisibilityConditionType.LIST
            ) {
                return {
                    type: OptionVisibilityConditionType.LIST,
                    controlledOptions: onshapeOptionCondition.controlledOptions,
                    condition
                };
            } else if (
                onshapeOptionCondition.btType ===
                OptionVisibilityConditionType.RANGE
            ) {
                const range = onshapeOptionCondition.controlledRange;
                return {
                    type: OptionVisibilityConditionType.RANGE,
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
): ParameterObj[] {
    const parameters: ParameterObj[] = [];

    for (const parameter of onshapeConfiguration.configurationParameters) {
        const base = {
            id: parameter.parameterId,
            name: parameter.parameterName,
            isCosmetic: parameter.isCosmetic,
            condition: parseVisibilityCondition(parameter.visibilityCondition)
        };

        if (parameter.btType === ConfigurationParameterType.ENUM) {
            const options: EnumOption[] = parameter.options.map((opt) => ({
                id: opt.option,
                name: opt.optionName
            }));
            parameters.push({
                ...base,
                type: ConfigurationParameterType.ENUM,
                default: parameter.defaultValue,
                options,
                optionConditions: parseOptionVisibilityConditions(
                    parameter.enumOptionVisibilityConditions
                )
            });
        } else if (parameter.btType === ConfigurationParameterType.BOOLEAN) {
            parameters.push({
                ...base,
                type: ConfigurationParameterType.BOOLEAN,
                default: String(parameter.defaultValue).toLowerCase()
            });
        } else if (parameter.btType === ConfigurationParameterType.STRING) {
            parameters.push({
                ...base,
                type: ConfigurationParameterType.STRING,
                default: parameter.defaultValue
            });
        } else if (parameter.btType === ConfigurationParameterType.QUANTITY) {
            const range = parameter.rangeAndDefault;
            const unit = range.units;
            const val = range.defaultValue;

            const abbr = getUnitDisplayStr(unit);
            const defaultStr = abbr ? `${val} ${abbr}` : String(val);

            parameters.push({
                ...base,
                type: ConfigurationParameterType.QUANTITY,
                quantityType: parameter.quantityType,
                default: defaultStr,
                defaultValue: val,
                min: range.minValue,
                max: range.maxValue,
                unit
            });
        }
    }

    return parameters;
}
