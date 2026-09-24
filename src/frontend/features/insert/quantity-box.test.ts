import { describe, expect, it } from "vitest";
import {
    ParameterType,
    type QuantityParameter
} from "@backend/features/configurations/contract";
import { QuantityType, Unit } from "@backend/features/configurations/enums";
import {
    getEvaluateOptions,
    PLACEHOLDER_UNIT_INFO
} from "@backend/features/configurations/utils";
import { seedFrom } from "./quantity-box";

const SHAFT_LENGTH: QuantityParameter = {
    id: "Length",
    name: "Length",
    type: ParameterType.QUANTITY,
    quantityType: QuantityType.LENGTH,
    default: "47 in",
    defaultValue: 47,
    min: 0,
    max: 100,
    unit: Unit.INCH
};

/** Standalone has no document to ask, so quantities show in the placeholder's units. */
const STANDALONE = getEvaluateOptions(SHAFT_LENGTH, PLACEHOLDER_UNIT_INFO);

describe("seedFrom", () => {
    // The box edits what was typed and shows what it evaluates to.
    it("opens an expression for editing as it was entered", () => {
        expect(seedFrom("(40 + 7) in", SHAFT_LENGTH, STANDALONE)).toEqual({
            expression: "(40 + 7) in",
            display: "47 in"
        });
    });

    it("shows the value in the document's unit when there is one", () => {
        const metric = getEvaluateOptions(SHAFT_LENGTH, {
            ...PLACEHOLDER_UNIT_INFO,
            lengthUnit: Unit.MILLIMETER,
            lengthPrecision: 1
        });
        expect(seedFrom("47 in", SHAFT_LENGTH, metric)).toEqual({
            expression: "47 in",
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
