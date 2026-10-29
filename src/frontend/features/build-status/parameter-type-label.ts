import { ParameterType } from "@backend/features/configurations/contract";

/** The short label for a parameter's type, shown as a badge. */
export function getParameterTypeLabel(type: ParameterType): string {
    switch (type) {
        case ParameterType.ENUM:
            return "Enum";
        case ParameterType.BOOLEAN:
            return "Boolean";
        case ParameterType.QUANTITY:
            return "Quantity";
        case ParameterType.STRING:
            return "Text";
    }
}
