import { ParameterType } from "@backend/features/configurations/contract";
import { m } from "../../paraglide/messages";

/** The short label for a parameter's type, shown as a badge. */
export function getParameterTypeLabel(type: ParameterType): string {
    switch (type) {
        case ParameterType.ENUM:
            return m.parameterTypeEnum();
        case ParameterType.BOOLEAN:
            return m.parameterTypeBoolean();
        case ParameterType.QUANTITY:
            return m.parameterTypeQuantity();
        case ParameterType.STRING:
            return m.parameterTypeText();
    }
}
