import {
    ParameterValues,
    EnumOption,
    EnumParameter,
    OptionVisibilityType,
    ConfigurationParameter,
    ParameterType,
    VisibilityCondition,
    VisibilityType
} from "./configuration-models";
import { LogicalOp } from "./configuration-enums";

export function evaluateCondition(
    condition: VisibilityCondition | undefined,
    configuration: Record<string, string>,
    parameters: ConfigurationParameter[]
): boolean {
    if (!condition) {
        return true;
    }

    if (condition.type == VisibilityType.LOGICAL) {
        if (condition.operation == LogicalOp.AND) {
            return condition.children.every((child) =>
                evaluateCondition(child, configuration, parameters)
            );
        } else {
            return condition.children.some((child) =>
                evaluateCondition(child, configuration, parameters)
            );
        }
    } else if (condition.type == VisibilityType.EQUAL) {
        return condition.value == configuration[condition.id];
    } else if (condition.type == VisibilityType.RANGE) {
        const parameter = parameters.find(
            (parameter) => parameter.id === condition.id
        );
        if (parameter?.type != ParameterType.ENUM) {
            throw new Error(
                "Visibility condition does not target a valid enum parameter."
            );
        }

        const optionIds = parameter.options.map((option) => option.id);
        const startIndex = optionIds.indexOf(condition.start);
        const endIndex = optionIds.indexOf(condition.end);
        return optionIds
            .slice(startIndex, endIndex + 1)
            .includes(configuration[condition.id]);
    } else if (condition.type === VisibilityType.ALWAYS_SHOWN) {
        return true;
    }
    return true;
}
export function encodeConfigurationForQuery(
    configuration?: ParameterValues
): string {
    if (!configuration) {
        return "";
    }
    return Object.entries(configuration)
        .map(([id, value]) => `${id}=${value}`)
        .join(";");
}

export function getOption(
    options: EnumOption[],
    optionId: string
): EnumOption | undefined {
    return options.find((option) => option.id == optionId);
}

/**
 * Returns the enum options visible given the current (possibly partial)
 * configuration, applying the parameter's option visibility conditions.
 */
export function getVisibleOptions(
    enumParameter: EnumParameter,
    configuration: ParameterValues,
    parameters: ConfigurationParameter[]
): EnumOption[] {
    // No conditions means everything is shown
    if (enumParameter.optionConditions.length === 0) {
        return enumParameter.options;
    }

    const optionIds = enumParameter.options.map((option) => option.id);

    const validOptionIds = enumParameter.optionConditions
        .filter((optionCondition) =>
            evaluateCondition(
                optionCondition.condition,
                configuration,
                parameters
            )
        )
        .flatMap((optionCondition) => {
            if (optionCondition.type == OptionVisibilityType.LIST) {
                return optionCondition.controlledOptions;
            } else if (optionCondition.type == OptionVisibilityType.RANGE) {
                return optionIds.slice(
                    optionIds.indexOf(optionCondition.start),
                    optionIds.indexOf(optionCondition.end) + 1
                );
            }
            throw new Error("Unhandled option condition type");
        });

    const validOptionsSet = new Set(validOptionIds);
    return enumParameter.options.filter((option) =>
        validOptionsSet.has(option.id)
    );
}
