import { describe, expect, it } from "vitest";
import {
    ParameterType,
    VisibilityType,
    type ConfigurationParameter,
    type PartialSelection
} from "@backend/features/configurations/models";
import { toSelection } from "@backend/features/configurations/selection";
import { evaluateCondition } from "@backend/features/configurations/utils";
import { withParameterValue } from "./parameter-value";

const SIZE: ConfigurationParameter = {
    id: "size",
    name: "Size",
    default: "small",
    isCosmetic: false,
    type: ParameterType.ENUM,
    options: [
        { id: "small", name: "Small" },
        { id: "large", name: "Large" }
    ],
    optionConditions: []
};

/** Only shown for the large size, so it is hidden by default. */
const REINFORCED: ConfigurationParameter = {
    id: "reinforced",
    name: "Reinforced",
    default: "false",
    isCosmetic: false,
    type: ParameterType.BOOLEAN,
    condition: { type: VisibilityType.EQUAL, id: "size", value: "large" }
};

const PARAMS = [SIZE, REINFORCED];

describe("withParameterValue", () => {
    it("writes the value a row was given", () => {
        const selection = toSelection({}, PARAMS);
        expect(withParameterValue(selection, SIZE, "large")).toEqual({
            size: "large",
            reinforced: "false"
        });
    });

    it("reads undefined as the parameter's default", () => {
        const selection = toSelection({ size: "large" }, PARAMS);
        expect(withParameterValue(selection, SIZE, undefined).size).toBe(
            "small"
        );
    });

    it("hands back the same selection when the value already stands", () => {
        const selection = toSelection({ size: "large" }, PARAMS);
        // Identity, not equality: it is what React compares to decide there is
        // nothing to re-render.
        expect(withParameterValue(selection, SIZE, "large")).toBe(selection);
        expect(withParameterValue(selection, REINFORCED, undefined)).toBe(
            selection
        );
    });
});

/**
 * The panel's render/effect cycle, run with the app's own functions: a hidden
 * parameter is cleared by an effect, and `toSelection` makes the selection whole
 * again on the next render. Comparing presence rather than value never reached a
 * fixed point here, so the panel re-rendered for as long as it was open.
 */
function passesToSettle(limit = 50): number | null {
    let stored: PartialSelection | undefined = undefined;
    for (let pass = 1; pass <= limit; pass++) {
        const whole = toSelection(stored ?? {}, PARAMS);
        const hidden = PARAMS.filter(
            (parameter) =>
                !evaluateCondition(parameter.condition, whole, PARAMS)
        );
        // Every hidden row's effect calls onValueChange(undefined).
        const next = hidden.reduce(
            (selection, parameter) =>
                withParameterValue(selection, parameter, undefined),
            whole
        );
        if (next === whole) return pass;
        stored = next;
    }
    return null;
}

describe("the panel's hidden-parameter cycle", () => {
    it("settles instead of re-rendering forever", () => {
        expect(passesToSettle()).toBe(1);
    });
});
