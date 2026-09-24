import { describe, expect, it } from "vitest";
import {
    type ConfigurationParameter,
    DEFAULT_CONFIGURATION_KEY,
    VisibilityType
} from "./contract";
import {
    appliedValues,
    canonicalValues,
    findRecord,
    formatValue,
    onshapeOverrides,
    toKey,
    toSelection,
    toShortestConfiguration,
    toStoredSelection,
    withDerivationValues
} from "./selection";
import { QuantityType, Unit } from "./enums";
import { decodeConfiguration } from "./utils";
import {
    boolParam,
    enumParam,
    quantityParam,
    derivationParam
} from "../../../__test_utils__/configuration-fixtures";

const size = enumParam("size", ["s", "l"]);
const flag = boolParam("flag");
const length = quantityParam("length");
const parameters = [size, flag, length];

/** What every boundary does: whatever arrived, made whole. */
function select(
    values: Record<string, string>,
    params: ConfigurationParameter[] = parameters
) {
    return toSelection(values, params);
}

describe("toSelection", () => {
    it("names every parameter, defaults in their own unit", () => {
        expect(select({ size: "l" })).toEqual({
            size: "l",
            flag: "false",
            length: "1 in"
        });
    });

    it("keeps an expression as it was entered", () => {
        expect(select({ length: "(2 + 3) in" }).length).toBe("(2 + 3) in");
        expect(select({ length: "  50.8 mm " }).length).toBe("50.8 mm");
    });

    it("spells a checkbox the one way Onshape does", () => {
        expect(select({ flag: "TRUE" }).flag).toBe("true");
    });

    it("drops what the parameters do not declare", () => {
        expect(select({ gone: "x" })).not.toHaveProperty("gone");
    });

    it("is unchanged by a second pass", () => {
        const once = select({ size: "l", length: "2 in" });
        expect(select(once)).toEqual(once);
    });
});

describe("toKey", () => {
    it("names only what the selection overrides", () => {
        expect(toKey(select({ size: "l" }), parameters)).toBe("size=l");
    });

    it("is empty for a selection that overrides nothing", () => {
        expect(toKey(select({ size: "s", length: "1 in" }), parameters)).toBe(
            DEFAULT_CONFIGURATION_KEY
        );
    });

    it("keys every spelling of one value alike", () => {
        const keys = ["2in", "2 in", "50.8 mm", "(1 + 1) in"].map((value) =>
            toKey(select({ length: value }), parameters)
        );
        expect(new Set(keys).size).toBe(1);
    });

    it("keys a value equal to the default in another unit as no override", () => {
        expect(toKey(select({ length: "25.4 mm" }), parameters)).toBe(
            DEFAULT_CONFIGURATION_KEY
        );
    });

    // Values the parser reads as equal must key one render, not two.
    it("ignores a difference below the parser's tolerance", () => {
        expect(
            toKey(select({ length: "0.02540000000001 m" }), parameters)
        ).toBe(DEFAULT_CONFIGURATION_KEY);
    });

    it("names parameters in declaration order, not object order", () => {
        const key = toKey(select({ flag: "true", size: "l" }), parameters);
        expect(key).toBe("size=l;flag=true");
    });

    it("drops a parameter the selection hides", () => {
        const hidden = enumParam("hidden", ["x", "y"], {
            condition: { type: VisibilityType.EQUAL, id: "size", value: "s" }
        });
        const params = [size, hidden];
        expect(toKey(select({ size: "l", hidden: "y" }, params), params)).toBe(
            "size=l"
        );
    });

    it("spells an angle in radians", () => {
        const angle = quantityParam("angle", {
            quantityType: QuantityType.ANGLE,
            unit: Unit.DEGREE,
            defaultValue: 0,
            max: 360
        });
        const key = toKey(select({ angle: "180 deg" }, [angle]), [angle]);
        const spelled = decodeConfiguration(key).angle;
        expect(spelled).toMatch(/ rad$/);
        expect(Number.parseFloat(spelled)).toBeCloseTo(Math.PI, 10);
    });
});

describe("onshapeOverrides", () => {
    it("sends a quantity as it was entered, not as its value", () => {
        expect(
            onshapeOverrides(select({ length: "(2 + 3) in" }), parameters)
        ).toEqual({ length: "(2 + 3) in" });
    });

    it("leaves out a value that is the default however it is spelled", () => {
        expect(
            onshapeOverrides(select({ length: "25.4 mm" }), parameters)
        ).toEqual({});
    });
});

describe("toShortestConfiguration", () => {
    it("names the first applied parameter at its value", () => {
        expect(toShortestConfiguration(select({}), parameters)).toEqual({
            size: "s"
        });
    });
});

describe("appliedValues", () => {
    const params = [
        size,
        {
            ...boolParam("reinforced"),
            condition: {
                type: VisibilityType.EQUAL as const,
                id: "size",
                value: "l"
            }
        }
    ];

    it("leaves out a parameter the selection hides", () => {
        expect(appliedValues(select({ size: "s" }, params), params)).toEqual({
            size: "s"
        });
    });

    it("keeps one the selection shows", () => {
        expect(appliedValues(select({ size: "l" }, params), params)).toEqual({
            size: "l",
            reinforced: "false"
        });
    });
});

describe("canonicalValues", () => {
    // Analytics counts these, where one value typed two ways is one value.
    it("spells two expressions of one value alike", () => {
        expect(canonicalValues(select({ length: "5 in" }), parameters)).toEqual(
            canonicalValues(select({ length: "(2 + 3) in" }), parameters)
        );
    });
});

describe("findRecord", () => {
    const own = { values: {} };
    const large = { values: { size: "l" } };
    const largeFlagged = { values: { size: "l", flag: "true" } };
    const records = [own, large, largeFlagged];

    it("picks the record naming the most of the selection", () => {
        expect(findRecord(select({ size: "l", flag: "true" }), records)).toBe(
            largeFlagged
        );
        expect(findRecord(select({ size: "l" }), records)).toBe(large);
    });

    // A record omits what its enumeration hid, so the selection's value for
    // that parameter says nothing either way.
    it("matches a record that omits a parameter it hid", () => {
        const b = { values: { size: "l" } };
        expect(findRecord({ size: "l", hidden: "x" }, [own, b])).toBe(b);
    });

    it("falls back to the element's own record", () => {
        expect(findRecord(select({}), records)).toBe(own);
    });
});

describe("formatValue", () => {
    it("reads a quantity evaluated, in the unit its parameter declares", () => {
        expect(formatValue(length, "(1 + 1) in")).toBe("2 in");
        expect(formatValue(length, "0.0508 m")).toBe("2 in");
    });

    it("reads a checkbox as its state rather than as the text it is stored as", () => {
        expect(formatValue(flag, "true")).toBe("Yes");
        expect(formatValue(flag, "false")).toBe("No");
    });

    it("leaves everything else as stored", () => {
        expect(formatValue(size, "l")).toBe("l");
        expect(formatValue(flag, "unset")).toBe("unset");
    });
});

describe("derivation variables", () => {
    const derivation = derivationParam("dv");
    const params: ConfigurationParameter[] = [size, derivation];

    // Unique to each insert by design, so it must not split one render in two.
    it("leaves them out of the key", () => {
        expect(toKey(select({ size: "l", dv: "abc" }, params), params)).toBe(
            "size=l"
        );
    });

    it("fills a fresh value for every derive", () => {
        const selection = select({ size: "l" }, params);
        const first = withDerivationValues(selection, params);
        const second = withDerivationValues(first, params);
        expect(first.dv).not.toBe(derivation.default);
        expect(second.dv).not.toBe(first.dv);
    });

    // What the panel does, so the value on screen holds still.
    it("keeps a value already filled when asked to", () => {
        const filled = withDerivationValues(select({}, params), params);
        expect(withDerivationValues(filled, params, true)).toEqual(filled);
    });

    it("leaves them out of what is stored", () => {
        expect(toStoredSelection({ size: "l", dv: "abc" }, params)).toEqual({
            size: "l"
        });
    });
});
