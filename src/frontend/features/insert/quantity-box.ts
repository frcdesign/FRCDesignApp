import { type QuantityParameter } from "@backend/features/configurations/contract";
import {
    type EvaluateOptions,
    evaluateExpression,
    formatValueWithUnits,
    valueWithUnits
} from "@backend/features/configurations/input-parser";

/** Everything the quantity box shows: the expression, its display, and any error. */
interface QuantityBox {
    /** Shown while the input has focus: what was typed, or what to edit. */
    expression: string;
    /** The evaluated value, shown while it does not. */
    display: string;
    errorMessage?: string;
}

/** The expression while focused, its value otherwise. */
export function seedFrom(
    value: string | undefined,
    parameter: QuantityParameter,
    options: EvaluateOptions
): QuantityBox {
    if (value === undefined) {
        const display = formatValueWithUnits(
            valueWithUnits(parameter.defaultValue, parameter.unit),
            options.displayUnit,
            options.displayPrecision
        );
        return { expression: display, display };
    }
    const result = evaluateExpression(value, options);
    // In the field, since this runs during render.
    return result.hasError
        ? {
              expression: result.expression,
              display: result.expression,
              errorMessage: result.errorMessage
          }
        : {
              expression: result.expression,
              display: result.displayExpression
          };
}
