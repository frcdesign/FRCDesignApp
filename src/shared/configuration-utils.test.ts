import { describe, expect, it } from "vitest";
import {
    DEFAULT_CONFIGURATION_KEY,
    canonicalizeConfiguration,
    configurationKey,
    encodeCanonicalConfiguration,
    findRecordForConfiguration
} from "./configuration-utils";
import {
    ParameterValues,
    SearchRecord,
    VisibilityType
} from "./configuration-models";
import {
    boolParam,
    enumParam,
    quantityParam,
    TEST_UNIT_INFO
} from "../__test_utils__/configuration-fixtures";

function rec(
    configuration: Record<string, string>,
    partNumber = "PN"
): SearchRecord {
    return { partNumber, name: null, configuration };
}

describe("findRecordForConfiguration", () => {
    it("returns the record whose enumerated values match the selection", () => {
        const records = [
            rec({ size: "s" }, "PN-S"),
            rec({ size: "l" }, "PN-L")
        ];
        // The selection also carries a non-enumerated (quantity) param, ignored.
        expect(
            findRecordForConfiguration({ size: "l", qty: "3" }, records)
                ?.partNumber
        ).toBe("PN-L");
    });

    it("prefers the most specific match when several apply", () => {
        const records = [rec({}, "default"), rec({ size: "l" }, "PN-L")];
        expect(
            findRecordForConfiguration({ size: "l" }, records)?.partNumber
        ).toBe("PN-L");
    });

    it("falls back to a shorter key-set when a parameter is hidden", () => {
        const records = [
            rec({ mode: "a", detail: "x" }, "A-X"),
            // `detail` is hidden when mode=b, so this record omits it.
            rec({ mode: "b" }, "B")
        ];
        expect(
            findRecordForConfiguration({ mode: "b", detail: "x" }, records)
                ?.partNumber
        ).toBe("B");
    });

    it("returns undefined when nothing matches", () => {
        const records = [rec({ size: "s" }, "PN-S")];
        expect(
            findRecordForConfiguration({ size: "l" }, records)
        ).toBeUndefined();
    });
});

describe("canonicalizeConfiguration", () => {
    const size = enumParam("size", ["s", "l"]);
    const flag = boolParam("flag");
    const length = quantityParam("length");

    function canon(
        configuration: Record<string, string>,
        parameters = [size, flag, length]
    ) {
        return canonicalizeConfiguration(
            configuration,
            parameters,
            TEST_UNIT_INFO
        );
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
        expect(configurationKey(a)).toBe(configurationKey(b));
    });

    it("collapses equivalent quantity spellings", () => {
        const keys = ["2in", "2 in", "(1 + 1) in"].map((value) =>
            configurationKey(canon({ length: value }))
        );
        expect(new Set(keys).size).toBe(1);
        // ...and it is not the default key, since 2 in != the 1 in default.
        expect(keys[0]).not.toBe(configurationKey({}));
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

// The two sides that address a thumbnail derive their configuration differently:
// an indexed record comes from `enumerateConfigurations` (visible, non-cosmetic
// enum/boolean values only, defaults included), while the insert menu holds the
// user's whole selection. Canonicalizing both is what makes them agree.
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
            parameters,
            TEST_UNIT_INFO
        );
        expect(configurationKey(record)).toBe(configurationKey(selection));
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
                configurationKey(
                    canonicalizeConfiguration(
                        selection,
                        parameters,
                        TEST_UNIT_INFO
                    )
                )
            ).not.toBe(configurationKey(record));
        }
    });
});

describe("configurationKey", () => {
    it("maps an empty configuration to the default key", () => {
        expect(configurationKey({})).toBe(DEFAULT_CONFIGURATION_KEY);
    });

    it("gives different configurations different keys", () => {
        expect(configurationKey({ a: "1" })).not.toBe(
            configurationKey({ a: "2" })
        );
    });
});
