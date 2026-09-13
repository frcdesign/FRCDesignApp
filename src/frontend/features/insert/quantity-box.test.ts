import { describe, expect, it } from "vitest";
import {
    ParameterType,
    type QuantityParameter
} from "@backend/features/configurations/contract";
import { QuantityType, Unit } from "@backend/features/configurations/enums";
import { getEvaluateOptions } from "@backend/features/configurations/utils";
import { canonicalizeValue } from "@backend/features/configurations/selection";
import { seedFrom } from "./quantity-box";

const SHAFT_LENGTH: QuantityParameter = {
    id: "Length",
    name: "Length",
    isCosmetic: false,
    type: ParameterType.QUANTITY,
    quantityType: QuantityType.LENGTH,
    default: "47 in",
    defaultValue: 47,
    min: 0,
    max: 100,
    unit: Unit.INCH
};

/** Standalone has no document to ask, so each quantity falls back to its own unit. */
const STANDALONE = getEvaluateOptions(SHAFT_LENGTH, {});

describe("seedFrom", () => {
    // A selection is canonically in base units, which is not a spelling anyone
    // wants handed to them in the box when they click into it.
    it("opens a canonical value for editing in the parameter's own unit", () => {
        const canonical = canonicalizeValue(SHAFT_LENGTH, SHAFT_LENGTH.default);
        expect(canonical).toBe("1.1938 m");

        expect(seedFrom(canonical, SHAFT_LENGTH, STANDALONE)).toEqual({
            expression: "47 in",
            display: "47 in"
        });
    });

    it("renders in the document's unit when there is one", () => {
        const metric = getEvaluateOptions(SHAFT_LENGTH, {
            lengthUnit: Unit.MILLIMETER,
            lengthPrecision: 1
        });
        expect(seedFrom("1.1938 m", SHAFT_LENGTH, metric)).toEqual({
            expression: "1193.8 mm",
            display: "1193.8 mm"
        });
    });

    it("falls back to the parameter's default when nothing is selected", () => {
        expect(seedFrom(undefined, SHAFT_LENGTH, STANDALONE)).toEqual({
            expression: "47 in",
            display: "47 in"
        });
    });

    it("shows an unevaluable value back with its error", () => {
        const box = seedFrom("not a length", SHAFT_LENGTH, STANDALONE);
        expect(box.expression).toBe("not a length");
        expect(box.errorMessage).toBeTruthy();
    });
});
