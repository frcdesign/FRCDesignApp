import {
    Configuration,
    ConfigurationParameterType,
    LogicalOp,
    ParameterObj,
    VisibilityCondition,
    VisibilityConditionType
} from "./configuration-models";

/**
 * Encodes a configuration into a string.
 * Used to send configurations as a query parameter to the backend.
 */
export function encodeConfigurationForQuery(
    configuration?: Configuration
): string {
    if (!configuration) {
        return "";
    }
    return Object.entries(configuration)
        .map(([id, value]) => `${id}=${value}`)
        .join(";");
}

/**
 * Evaluates a visibility condition.
 * Returns true if the controlled part should be shown, and false otherwise.
 */
export function evaluateCondition(
    condition: VisibilityCondition | undefined,
    configuration: Record<string, string>,
    parameters: ParameterObj[]
): boolean {
    if (!condition) {
        return true;
    }

    if (condition.type == VisibilityConditionType.LOGICAL) {
        if (condition.operation == LogicalOp.AND) {
            return condition.children.every((child) =>
                evaluateCondition(child, configuration, parameters)
            );
        } else {
            return condition.children.some((child) =>
                evaluateCondition(child, configuration, parameters)
            );
        }
    } else if (condition.type == VisibilityConditionType.EQUAL) {
        return condition.value == configuration[condition.id];
    } else if (condition.type == VisibilityConditionType.RANGE) {
        const parameter = parameters.find(
            (parameter) => parameter.id === condition.id
        );
        if (!parameter || parameter.type != ConfigurationParameterType.ENUM) {
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
    }
    return true;
}
