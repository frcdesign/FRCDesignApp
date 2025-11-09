import { QuantityType, Unit } from "../configuration-models";
import {
    evaluateExpression,
    EvaluateOptions,
    Result,
    valueWithUnits
} from "../parser";

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

describe("evaluateExpression - valid expressions", () => {
    it("parses simple number (unitless)", () => {
        const res = evaluateExpression(
            "42",
            defaultOptions(QuantityType.REAL, Unit.UNITLESS)
        );
        expect(res.hasError).toBe(false);
        expect((res as Result).displayExpression).toBe("42");
    });

    it("parses number with unit", () => {
        const res = evaluateExpression(
            "10 mm",
            defaultOptions(QuantityType.LENGTH)
        );
        expect(res.hasError).toBe(false);
        expect((res as Result).displayExpression).toBe("10 mm");
    });

    it("parses addition with units", () => {
        const res = evaluateExpression("5 mm + 5 mm", defaultOptions());
        expect(res.hasError).toBe(false);
        expect((res as Result).displayExpression).toBe("10 mm");
    });

    it("parses subtraction with units", () => {
        const res = evaluateExpression("15 mm - 5 mm", defaultOptions());
        expect(res.hasError).toBe(false);
        expect((res as Result).displayExpression).toBe("10 mm");
    });

    it("parses multiplication with unit and number", () => {
        const res = evaluateExpression("2 * 5 mm", defaultOptions());
        expect(res.hasError).toBe(false);
        expect((res as Result).displayExpression).toBe("10 mm");
    });

    it("parses division with unit and number", () => {
        const res = evaluateExpression("10 / 2 mm", defaultOptions());
        expect(res.hasError).toBe(false);
        expect((res as Result).displayExpression).toBe("5 mm");
    });

    it("parses parenthesis with unit", () => {
        const res = evaluateExpression("(2 + 3) mm", defaultOptions());
        expect(res.hasError).toBe(false);
        expect((res as Result).displayExpression).toBe("5 mm");
    });

    it("parses negative numbers", () => {
        const res = evaluateExpression("-5 mm", defaultOptions());
        expect(res.hasError).toBe(false);
        expect((res as Result).displayExpression).toBe("-5 mm");
    });

    it("parses angles in degrees", () => {
        const res = evaluateExpression(
            "90 deg",
            defaultOptions(QuantityType.ANGLE, Unit.DEGREE)
        );
        expect(res.hasError).toBe(false);
        expect((res as Result).displayExpression).toBe("90 deg");
    });

    it("parses angles in radians", () => {
        const res = evaluateExpression(
            "3.14159265359 rad",
            defaultOptions(QuantityType.ANGLE, Unit.RADIAN)
        );
        expect(res.hasError).toBe(false);
        expect((res as Result).displayExpression).toContain("rad");
    });

    it("applies default unit for unitless input", () => {
        const res = evaluateExpression("5", defaultOptions());
        expect(res.hasError).toBe(false);
        expect((res as Result).displayExpression).toBe("5 mm");
    });

    it("handles whitespace and spacing", () => {
        const res = evaluateExpression(
            "   7   mm   +   3 mm ",
            defaultOptions()
        );
        expect(res.hasError).toBe(false);
        expect((res as Result).displayExpression).toBe("10 mm");
    });
});

describe("evaluateExpression - failure cases", () => {
    it("fails on empty input", () => {
        const res = evaluateExpression("", defaultOptions());
        expect(res.hasError).toBe(true);
    });

    it("fails on invalid unit", () => {
        const res = evaluateExpression("5 bananas", defaultOptions());
        expect(res.hasError).toBe(true);
    });

    it("fails on mismatched units in addition", () => {
        const res = evaluateExpression("5 mm + 2 deg", defaultOptions());
        expect(res.hasError).toBe(true);
    });

    it("fails on division by zero", () => {
        const res = evaluateExpression("10 mm / 0", defaultOptions());
        expect(res.hasError).toBe(true);
    });

    it("fails on invalid syntax", () => {
        const res = evaluateExpression("5 +", defaultOptions());
        expect(res.hasError).toBe(true);
    });

    it("fails on unit applied to non-number", () => {
        const res = evaluateExpression("(5 mm) mm", defaultOptions());
        expect(res.hasError).toBe(true);
    });

    it("fails on multiplication of two units", () => {
        const res = evaluateExpression("5 mm * 2 mm", defaultOptions());
        expect(res.hasError).toBe(true);
    });

    it("fails on division of two units", () => {
        const res = evaluateExpression("5 mm / 2 mm", defaultOptions());
        expect(res.hasError).toBe(true);
    });

    it("fails if value is less than min", () => {
        const res = evaluateExpression("-1000 mm", defaultOptions());
        expect(res.hasError).toBe(true);
    });

    it("fails if value is greater than max", () => {
        const res = evaluateExpression("2000 mm", defaultOptions());
        expect(res.hasError).toBe(true);
    });
});
