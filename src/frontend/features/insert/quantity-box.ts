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

/**
 * What the box shows for a value, and the error if it does not evaluate: the
 * expression to edit while focused, and what it evaluates to otherwise.
 */
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
    // Reported in the field rather than as a toast: the field is where the
    // value is, and seeding happens during render.
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
