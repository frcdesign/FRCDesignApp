import { describe, expect, it } from "vitest";
import {
    OptionVisibilityType,
    ParameterType,
    VisibilityType,
    type ConfigurationParameter,
    type PartialSelection
} from "@backend/features/configurations/contract";
import { toSelection } from "@backend/features/configurations/selection";
import { evaluateCondition } from "@backend/features/configurations/utils";
import { normalizeSelection, withParameterValue } from "./parameter-value";

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
 * The panel's cycle, run with the app's own functions: an effect clears a hidden
 * parameter and `toSelection` puts it back. Comparing presence never settled.
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

describe("normalizeSelection", () => {
    it("settles a hidden parameter on its default", () => {
        const selection = toSelection(
            { size: "small", reinforced: "true" },
            PARAMS
        );
        expect(normalizeSelection(selection, PARAMS).reinforced).toBe("false");
    });

    it("leaves a shown parameter's value alone", () => {
        const selection = toSelection(
            { size: "large", reinforced: "true" },
            PARAMS
        );
        expect(normalizeSelection(selection, PARAMS).reinforced).toBe("true");
    });

    it("is idempotent, which is what lets the panel stop", () => {
        const once = normalizeSelection(toSelection({}, PARAMS), PARAMS);
        // Identity: the second pass finds nothing to change.
        expect(normalizeSelection(once, PARAMS)).toBe(once);
    });

    it("falls back to a visible option when the selected one is hidden", () => {
        const material: ConfigurationParameter = {
            id: "material",
            name: "Material",
            default: "alu",
            isCosmetic: false,
            type: ParameterType.ENUM,
            options: [
                { id: "alu", name: "Aluminium" },
                { id: "steel", name: "Steel" }
            ],
            // Steel is only offered on the large size.
            optionConditions: [
                {
                    type: OptionVisibilityType.LIST,
                    controlledOptions: ["steel"],
                    condition: {
                        type: VisibilityType.EQUAL,
                        id: "size",
                        value: "large"
                    }
                },
                {
                    type: OptionVisibilityType.LIST,
                    controlledOptions: ["alu"],
                    condition: { type: VisibilityType.ALWAYS_SHOWN }
                }
            ]
        };
        const params = [SIZE, material];
        const selection = toSelection(
            { size: "small", material: "steel" },
            params
        );
        expect(normalizeSelection(selection, params).material).toBe("alu");
    });

    it("settles a chain where one parameter decides the next", () => {
        // `reinforced` is hidden unless size is large, and `bolts` unless
        // reinforced — so clearing size has to reach bolts too.
        const bolts: ConfigurationParameter = {
            id: "bolts",
            name: "Bolts",
            default: "2",
            isCosmetic: false,
            type: ParameterType.ENUM,
            options: [
                { id: "2", name: "Two" },
                { id: "4", name: "Four" }
            ],
            optionConditions: [],
            condition: {
                type: VisibilityType.EQUAL,
                id: "reinforced",
                value: "true"
            }
        };
        const params = [SIZE, REINFORCED, bolts];
        const selection = toSelection(
            { size: "small", reinforced: "true", bolts: "4" },
            params
        );
        const settled = normalizeSelection(selection, params);
        expect(settled.reinforced).toBe("false");
        expect(settled.bolts).toBe("2");
    });
});
