import { describe, expect, it } from "vitest";
import {
    appliedValues,
    ELEMENT_DEFAULT_KEY,
    formatValue,
    fromKey,
    toKey,
    toSelection
} from "./selection";
import { VisibilityType } from "./models";
import { QuantityType, Unit } from "./enums";
import {
    boolParam,
    enumParam,
    quantityParam
} from "../../../__test_utils__/configuration-fixtures";

const size = enumParam("size", ["s", "l"]);
const flag = boolParam("flag");
const length = quantityParam("length");
const parameters = [size, flag, length];

/** What every boundary does: whatever arrived, made whole and canonical. */
function select(values: Record<string, string>, params = parameters) {
    return toSelection(values, params);
}

describe("toSelection", () => {
    it("names every parameter, whatever it was given", () => {
        expect(select({ size: "l" })).toEqual({
            size: "l",
            flag: "false",
            length: "0.0254 m"
        });
    });

    it("spells equivalent values the same way", () => {
        for (const value of ["2in", "2 in", "50.8 mm", "(1 + 1) in"]) {
            expect(select({ length: value }).length).toBe("0.0508 m");
        }
    });

    it("keeps an unparseable value as typed", () => {
        expect(select({ length: "#value" }).length).toBe("#value");
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
            ELEMENT_DEFAULT_KEY
        );
    });

    it("names parameters in declaration order, not object order", () => {
        const key = toKey(select({ flag: "true", size: "l" }), parameters);
        expect(key).toBe("size=l;flag=true");
        expect(toKey(select({ size: "l", flag: "true" }), parameters)).toBe(
            key
        );
    });

    it("drops a parameter the selection hides", () => {
        const hidden = enumParam("hidden", ["x", "y"], {
            condition: { type: VisibilityType.EQUAL, id: "size", value: "s" }
        });
        const params = [size, hidden];
        // size=l hides `hidden`, so its value cannot affect the render.
        expect(toKey(select({ size: "l", hidden: "y" }, params), params)).toBe(
            "size=l"
        );
    });

    it("keys a value equal to the default in another unit as no override", () => {
        expect(toKey(select({ length: "25.4 mm" }), parameters)).toBe(
            ELEMENT_DEFAULT_KEY
        );
    });

    // Values the parser reads as equal must key one render, not two.
    it("ignores a difference below the parser's tolerance", () => {
        expect(
            toKey(select({ length: "0.02540000000001 m" }), parameters)
        ).toBe(toKey(select({ length: "1 in" }), parameters));
    });

    it("spells an angle in radians", () => {
        const angle = quantityParam("angle", {
            quantityType: QuantityType.ANGLE,
            unit: Unit.DEGREE,
            default: "0 deg",
            defaultValue: 0,
            max: 360
        });
        const spelled = toKey(select({ angle: "180 deg" }, [angle]), [
            angle
        ]).replace("angle=", "");
        expect(spelled).toMatch(/ rad$/);
        expect(Number.parseFloat(spelled)).toBeCloseTo(Math.PI, 10);
    });
});

describe("fromKey", () => {
    it("round-trips every key toKey produces", () => {
        const cases: Record<string, string>[] = [
            { size: "l" },
            { size: "l", flag: "true", length: "2 in" },
            { size: "s" }
        ];
        for (const values of cases) {
            const key = toKey(select(values), parameters);
            expect(toKey(fromKey(key, parameters), parameters)).toBe(key);
        }
    });

    it("fills what the key leaves unnamed", () => {
        expect(fromKey("size=l", parameters)).toEqual(select({ size: "l" }));
    });
});

describe("appliedValues", () => {
    const hidden = boolParam("reinforced");
    const params = [
        size,
        {
            ...hidden,
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

describe("formatValue", () => {
    it("reads a quantity back in the unit its parameter declares", () => {
        expect(formatValue(length, "0.0508 m")).toBe("2 in");
    });

    it("leaves everything else as stored", () => {
        expect(formatValue(size, "l")).toBe("l");
    });
});

// An indexed record varies enumerated parameters only, while the insert menu
// holds the whole selection. One key is what makes the two agree on a render.
describe("the surfaces agree", () => {
    const finish = enumParam("finish", ["matte", "gloss"], {
        isCosmetic: true
    });
    const all = [size, flag, finish, length];

    it("spells an enumerated record and the equivalent selection alike", () => {
        expect(toKey(select({ size: "l", flag: "false" }, all), all)).toBe(
            toKey(
                select(
                    {
                        size: "l",
                        flag: "false",
                        finish: "matte",
                        length: "1 in"
                    },
                    all
                ),
                all
            )
        );
    });

    it("spells a non-default cosmetic or quantity value differently", () => {
        // Enumeration never varies these, but they do change what renders.
        const record = toKey(select({ size: "l" }, all), all);
        const cases: Record<string, string>[] = [
            { size: "l", finish: "gloss" },
            { size: "l", length: "2 in" }
        ];
        for (const values of cases) {
            expect(toKey(select(values, all), all)).not.toBe(record);
        }
    });
});
