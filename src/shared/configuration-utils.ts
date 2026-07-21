import {
    Configuration,
    ParameterObj,
    ParameterType,
    VisibilityCondition,
    VisibilityType
} from "./configuration-models";
import { LogicalOp } from "./configuration-enums";

export function evaluateCondition(
    condition: VisibilityCondition | undefined,
    configuration: Record<string, string>,
    parameters: ParameterObj[]
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
    configuration?: Configuration
): string {
    if (!configuration) {
        return "";
    }
    return Object.entries(configuration)
        .map(([id, value]) => `${id}=${value}`)
        .join(";");
}
