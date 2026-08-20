import { describe, expect, it } from "vitest";
import {
    DEFAULT_CANONICAL_CONFIGURATION,
    DEFAULT_CONFIGURATION_KEY,
    canonicalConfigurationKey,
    canonicalizeConfiguration,
    encodeCanonicalConfiguration
} from "./canonical";
import { ParameterValues, VisibilityType } from "./models";
import { QuantityType, Unit } from "./enums";
import {
    boolParam,
    enumParam,
    quantityParam
} from "../../../__test_utils__/configuration-fixtures";

/** The key of an already-canonical selection, which is what callers compare. */
function keyOf(canonicalConfiguration: ParameterValues): string {
    return canonicalConfigurationKey(
        encodeCanonicalConfiguration(canonicalConfiguration)
    );
}

describe("canonicalizeConfiguration", () => {
    const size = enumParam("size", ["s", "l"]);
    const flag = boolParam("flag");
    const length = quantityParam("length");

    function canon(
        configuration: Record<string, string>,
        parameters = [size, flag, length]
    ) {
        return canonicalizeConfiguration(configuration, parameters);
    }

    it("drops values that match the parameter default", () => {
        // "s" and "false" are the defaults, so Onshape renders them anyway.
        expect(canon({ size: "s", flag: "false", length: "1 in" })).toEqual({});
    });

    it("keeps only what differs from the defaults", () => {
        expect(canon({ size: "l", flag: "false" })).toEqual({ size: "l" });
    });

    it("emits parameters in declaration order, not object order", () => {
        const a = canon({ flag: "true", size: "l" });
        const b = canon({ size: "l", flag: "true" });
        expect(Object.keys(a)).toEqual(["size", "flag"]);
        expect(encodeCanonicalConfiguration(a)).toBe(
            encodeCanonicalConfiguration(b)
        );
        expect(keyOf(a)).toBe(keyOf(b));
    });

    it("collapses equivalent quantity spellings", () => {
        const keys = ["2in", "2 in", "(1 + 1) in"].map((value) =>
            keyOf(canon({ length: value }))
        );
        expect(new Set(keys).size).toBe(1);
        // ...and it is not the default key, since 2 in != the 1 in default.
        expect(keys[0]).not.toBe(keyOf({}));
    });

    it("drops a parameter hidden by its visibility condition", () => {
        const hidden = enumParam("hidden", ["x", "y"], {
            condition: {
                type: VisibilityType.EQUAL,
                id: "size",
                value: "s"
            }
        });
        // size=l hides `hidden`, so its value can't affect the render.
        expect(canon({ size: "l", hidden: "y" }, [size, hidden])).toEqual({
            size: "l"
        });
    });

    it("ignores parameters that aren't set", () => {
        expect(canon({ size: "l" })).toEqual({ size: "l" });
    });
});

// An indexed record holds enumerated values only; the insert menu holds the whole
// selection. Canonicalizing both is what makes the two agree on a thumbnail.
describe("canonical keys agree across surfaces", () => {
    const size = enumParam("size", ["s", "l"]);
    const flag = boolParam("flag");
    const finish = enumParam("finish", ["matte", "gloss"], {
        isCosmetic: true
    });
    const length = quantityParam("length");
    const parameters = [size, flag, finish, length];

    it("keys an enumerated record and the equivalent selection alike", () => {
        // What indexing stores: enumerated values, no cosmetic/quantity params.
        const record = canonicalizeConfiguration(
            { size: "l", flag: "false" },
            parameters
        );
        // What the insert menu holds: everything, including the defaults.
        const selection = canonicalizeConfiguration(
            { size: "l", flag: "false", finish: "matte", length: "1 in" },
            parameters
        );
        expect(keyOf(record)).toBe(keyOf(selection));
    });

    it("keys a non-default cosmetic or quantity value differently", () => {
        // Enumeration never varies these, but they do change what renders, so
        // the selection must not collide with the enumerated record.
        const record = canonicalizeConfiguration({ size: "l" }, parameters);
        const selections: ParameterValues[] = [
            { size: "l", finish: "gloss" },
            { size: "l", length: "2 in" }
        ];
        for (const selection of selections) {
            expect(
                keyOf(canonicalizeConfiguration(selection, parameters))
            ).not.toBe(keyOf(record));
        }
    });
});

describe("quantity canonicalization", () => {
    const length = quantityParam("length");
    const angle = quantityParam("angle", {
        quantityType: QuantityType.ANGLE,
        unit: Unit.DEGREE,
        default: "0 deg",
        defaultValue: 0,
        max: 360
    });

    it("spells a length in meters, whatever unit was typed", () => {
        for (const value of ["2 in", "50.8 mm", "5.08 cm", "(1 + 1) in"]) {
            expect(
                canonicalizeConfiguration({ length: value }, [length])
            ).toEqual({ length: "0.0508 m" });
        }
    });

    it("spells an angle in radians", () => {
        expect(
            canonicalizeConfiguration({ angle: "180 deg" }, [angle])
        ).toEqual({ angle: `${Number(Math.PI.toFixed(7))} rad` });
    });

    // The document's display units used to decide the spelling, so the same
    // selection keyed differently for two users.
    it("does not depend on the document's units", () => {
        expect(canonicalizeConfiguration({ length: "1 in" }, [length])).toEqual(
            canonicalizeConfiguration({ length: "25.4 mm" }, [length])
        );
    });

    it("drops a value equal to the default in another unit", () => {
        expect(
            canonicalizeConfiguration({ length: "25.4 mm" }, [length])
        ).toEqual({});
    });

    it("keeps an unparseable value as typed", () => {
        expect(
            canonicalizeConfiguration({ length: "#value" }, [length])
        ).toEqual({ length: "#value" });
    });
});

describe("canonicalConfigurationKey", () => {
    it("maps an empty configuration to the default key", () => {
        expect(keyOf({})).toBe(DEFAULT_CONFIGURATION_KEY);
    });

    it("gives different configurations different keys", () => {
        expect(keyOf({ a: "1" })).not.toBe(keyOf({ a: "2" }));
    });
});

describe("encodeCanonicalConfiguration", () => {
    it("encodes the default as the empty string", () => {
        expect(encodeCanonicalConfiguration({})).toBe(
            DEFAULT_CANONICAL_CONFIGURATION
        );
    });

    it("joins values in the order canonicalizing emitted them", () => {
        expect(encodeCanonicalConfiguration({ size: "l", flag: "true" })).toBe(
            "size=l;flag=true"
        );
    });
});
