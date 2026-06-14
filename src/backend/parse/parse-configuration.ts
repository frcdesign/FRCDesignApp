import {
    ConfigurationParameterType,
    ConfigurationResult,
    EnumOption,
    OptionVisibilityCondition,
    OptionVisibilityConditionType,
    ParameterObj,
    QuantityType,
    Unit,
    VisibilityCondition,
    VisibilityConditionType,
    getUnitDisplayStr,
    LogicalOp
} from "../../shared/configuration-models";

const VISIBILITY_CONDITION_NONE = "BTParameterVisibilityCondition-177";

function parseVisibilityCondition(
    onshapeCondition: any
): VisibilityCondition | undefined {
    if (!onshapeCondition) return undefined;

    const conditionType: string = onshapeCondition.btType;
    if (conditionType === VISIBILITY_CONDITION_NONE) return undefined;

    if (conditionType === VisibilityConditionType.LOGICAL) {
        const children = onshapeCondition.children
            .map(parseVisibilityCondition)
            .filter(
                (condition: VisibilityCondition | undefined) => !!condition
            );

        return {
            type: VisibilityConditionType.LOGICAL,
            operation: onshapeCondition.operation as LogicalOp,
            children
        };
    } else if (conditionType === VisibilityConditionType.EQUAL) {
        return {
            type: VisibilityConditionType.EQUAL,
            id: onshapeCondition.parameterId,
            value: onshapeCondition.value
        };
    } else if (conditionType === VisibilityConditionType.RANGE) {
        const optionRange = onshapeCondition.optionRange;
        return {
            type: VisibilityConditionType.RANGE,
            id: onshapeCondition.parameterId,
            start: optionRange.start,
            end: optionRange.end
        };
    } else if (conditionType === VisibilityConditionType.ALWAYS_SHOWN) {
        return { type: VisibilityConditionType.ALWAYS_SHOWN };
    }

    return undefined;
}

function parseOptionVisibilityConditions(
    onshapeOptionConditions: any
): OptionVisibilityCondition[] {
    if (!onshapeOptionConditions) return [];

    return onshapeOptionConditions.visibilityConditions
        .map((onshapeOptionCondition: any) => {
            const condition = parseVisibilityCondition(
                onshapeOptionCondition.condition
            );

            if (!condition) return null;

            const conditionType: string = onshapeOptionCondition.btType;
            if (conditionType === OptionVisibilityConditionType.LIST) {
                return {
                    type: OptionVisibilityConditionType.LIST,
                    controlledOptions:
                        onshapeOptionCondition.controlledOptions as string[],
                    condition
                };
            } else if (conditionType === OptionVisibilityConditionType.RANGE) {
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
        .filter((condition: OptionVisibilityCondition | null) => !!condition);
}

export function parseOnshapeConfiguration(
    onshapeConfiguration: any
): ConfigurationResult {
    const parameters: ParameterObj[] = [];

    for (const parameter of onshapeConfiguration.configurationParameters as any[]) {
        const type: ConfigurationParameterType = parameter.btType;
        const base = {
            id: parameter.parameterId as string,
            name: parameter.parameterName as string,
            condition: parseVisibilityCondition(parameter.visibilityCondition)
        };

        if (type === ConfigurationParameterType.ENUM) {
            const options: EnumOption[] = (parameter.options as any[]).map(
                (opt) => ({
                    id: opt.option as string,
                    name: opt.optionName as string
                })
            );
            parameters.push({
                ...base,
                type,
                default: parameter.defaultValue as string,
                options,
                optionConditions: parseOptionVisibilityConditions(
                    parameter.enumOptionVisibilityConditions
                )
            });
        } else if (type === ConfigurationParameterType.BOOLEAN) {
            parameters.push({
                ...base,
                type,
                default: String(parameter.defaultValue).toLowerCase()
            });
        } else if (type === ConfigurationParameterType.STRING) {
            parameters.push({
                ...base,
                type,
                default: parameter.defaultValue as string
            });
        } else if (type === ConfigurationParameterType.QUANTITY) {
            const range = parameter.rangeAndDefault;
            const unit: Unit = range.units;
            const val: number = range.defaultValue;

            const abbr = getUnitDisplayStr(unit);
            const defaultStr = abbr ? `${val} ${abbr}` : String(val);

            parameters.push({
                ...base,
                type,
                quantityType: parameter.quantityType as QuantityType,
                default: defaultStr,
                defaultValue: val,
                min: range.minValue as number,
                max: range.maxValue as number,
                unit
            });
        }
    }

    return { parameters };
}
