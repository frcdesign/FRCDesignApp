import { describe, expect, it } from "vitest";
import { QuantityType, Unit } from "./enums";
import {
    evaluateExpression,
    EvaluateOptions,
    Result,
    valueWithUnits
} from "./input-parser";

const defaultOptions = (
    quantityType: QuantityType = QuantityType.LENGTH,
    displayUnit: Unit = Unit.MILLIMETER
): EvaluateOptions => ({
    quantityType,
    displayPrecision: 2,
    displayUnit,
    min: valueWithUnits(-100, displayUnit),
    max: valueWithUnits(100, displayUnit)
});

/** Every valid case reads the same way: an expression in, a display string out. */
describe("evaluateExpression", () => {
    const REAL = defaultOptions(QuantityType.REAL, Unit.UNITLESS);
    const LENGTH = defaultOptions();
    const DEGREES = defaultOptions(QuantityType.ANGLE, Unit.DEGREE);

    it.each([
        ["42", REAL, "42"],
        ["10 mm", LENGTH, "10 mm"],
        ["5 mm + 5 mm", LENGTH, "10 mm"],
        ["15 mm - 5 mm", LENGTH, "10 mm"],
        ["2 * 5 mm", LENGTH, "10 mm"],
        ["10 / 2 mm", LENGTH, "5 mm"],
        ["(2 + 3) mm", LENGTH, "5 mm"],
        ["-5 mm", LENGTH, "-5 mm"],
        ["90 deg", DEGREES, "90 deg"],
        // The display unit fills in for an expression that names none.
        ["5", LENGTH, "5 mm"],
        ["   7   mm   +   3 mm ", LENGTH, "10 mm"]
    ])("evaluates %s", (expression, options, display) => {
        const result = evaluateExpression(expression, options);
        expect(result.hasError).toBe(false);
        expect((result as Result).displayExpression).toBe(display);
    });

    it("evaluates an angle in radians", () => {
        const result = evaluateExpression(
            "3.14159265359 rad",
            defaultOptions(QuantityType.ANGLE, Unit.RADIAN)
        );
        expect(result.hasError).toBe(false);
        expect((result as Result).displayExpression).toContain("rad");
    });

    it.each([
        ["", "there is nothing to evaluate"],
        ["5 bananas", "the unit is not one we know"],
        ["5 mm + 2 deg", "the units do not match"],
        ["10 mm / 0", "it divides by zero"],
        ["5 +", "the syntax is incomplete"],
        ["(5 mm) mm", "a unit is applied to something already dimensioned"],
        ["5 mm * 2 mm", "two units are multiplied"],
        ["5 mm / 2 mm", "two units are divided"],
        ["-100.001 mm", "it falls below the minimum"],
        ["100.001 mm", "it rises above the maximum"]
    ])("rejects %s, since %s", (expression) => {
        expect(evaluateExpression(expression, LENGTH).hasError).toBe(true);
    });
});
