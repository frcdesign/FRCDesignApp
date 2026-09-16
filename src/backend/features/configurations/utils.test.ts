import { describe, expect, it } from "vitest";
import {
    decodeConfiguration,
    encodeConfiguration,
    evaluateCondition,
    findRecordForConfiguration,
    getPartUrl,
    getVisibleOptions
} from "./utils";
import {
    OptionVisibilityType,
    PartMetadata,
    SearchRecord,
    VisibilityType,
    type ConfigurationParameter
} from "./contract";
import { LogicalOp } from "./enums";
import { Vendor } from "../library/vendors";
import { enumParam } from "../../../__test_utils__/configuration-fixtures";

function rec(configurationKey: string, partNumber = "PN"): SearchRecord {
    return { partNumber, configurationKey };
}

describe("findRecordForConfiguration", () => {
    it("returns the record whose enumerated values match the selection", () => {
        const records = [rec("size=s", "PN-S"), rec("size=l", "PN-L")];
        // The selection also carries a non-enumerated (quantity) param, ignored.
        expect(
            findRecordForConfiguration("size=l;qty=3", records)?.partNumber
        ).toBe("PN-L");
    });

    it("prefers the most specific match when several apply", () => {
        const records = [rec("", "default"), rec("size=l", "PN-L")];
        expect(findRecordForConfiguration("size=l", records)?.partNumber).toBe(
            "PN-L"
        );
    });

    it("falls back to a less specific record when a parameter is hidden", () => {
        const records = [
            rec("mode=a;detail=x", "A-X"),
            // `detail` is hidden when mode=b, so this record omits it.
            rec("mode=b", "B")
        ];
        expect(
            findRecordForConfiguration("mode=b;detail=x", records)?.partNumber
        ).toBe("B");
    });

    it("returns undefined when nothing matches", () => {
        const records = [rec("size=s", "PN-S")];
        expect(findRecordForConfiguration("size=l", records)).toBeUndefined();
    });
});

describe("configuration text", () => {
    it("encodes the empty configuration as the empty string", () => {
        expect(encodeConfiguration({})).toBe("");
        expect(encodeConfiguration(undefined)).toBe("");
    });

    it("joins values in the order they were set", () => {
        expect(encodeConfiguration({ size: "l", flag: "true" })).toBe(
            "size=l;flag=true"
        );
    });

    it("round-trips the values it names", () => {
        const configuration = { size: "l", length: "0.0508 m" };
        expect(decodeConfiguration(encodeConfiguration(configuration))).toEqual(
            configuration
        );
    });

    it("decodes the empty string as no values at all", () => {
        expect(decodeConfiguration("")).toEqual({});
    });

    it("percent-encodes a value", () => {
        expect(encodeConfiguration({ length: "0.0508 m" })).toBe(
            "length=0.0508%20m"
        );
    });

    it("round-trips a value holding the separators", () => {
        const configuration = { label: "a;other=evil", other: "x" };
        expect(decodeConfiguration(encodeConfiguration(configuration))).toEqual(
            configuration
        );
    });

    it("round-trips a value holding a percent sign", () => {
        const configuration = { label: "50%3B off" };
        expect(decodeConfiguration(encodeConfiguration(configuration))).toEqual(
            configuration
        );
    });

    it("keeps a typed separator from setting another parameter", () => {
        const encoded = encodeConfiguration({ label: "a;other=evil" });
        expect(decodeConfiguration(encoded).other).toBeUndefined();
    });
});

function metadata(fields: Partial<PartMetadata>): PartMetadata {
    return { hasMultipleParts: false, isOpenComposite: false, ...fields };
}

describe("getPartUrl", () => {
    it("prefers a description that is already a url, naming the exact product", () => {
        const url = getPartUrl(
            metadata({
                vendor: "WCP",
                partNumber: "WCP-1025",
                description: "https://wcproducts.com/products/something-else"
            })
        );
        expect(url).toBe("https://wcproducts.com/products/something-else");
    });

    it("falls back to the vendor's page when the description is prose", () => {
        const url = getPartUrl(
            metadata({
                vendor: "WCP",
                partNumber: "WCP-1025",
                description: "A gearbox"
            })
        );
        expect(url).toBe("https://wcproducts.com/products/wcp-1025");
    });

    it("has none for a vendor whose urls cannot be derived", () => {
        expect(
            getPartUrl(metadata({ vendor: "SDS", partNumber: "sds-1234" }))
        ).toBeUndefined();
    });

    it("falls back to the insertable's vendor when the record names none", () => {
        const url = getPartUrl(metadata({ partNumber: "WCP-1025" }), [
            Vendor.WCP
        ]);
        expect(url).toBe("https://wcproducts.com/products/wcp-1025");
    });

    it("will not guess between several, which do not say which this is", () => {
        expect(
            getPartUrl(metadata({ partNumber: "1025" }), [
                Vendor.WCP,
                Vendor.MCM
            ])
        ).toBeUndefined();
    });

    // A part configurable across vendors carries a generic vendor, but each
    // configuration's number still says who sells that one.
    it("reads the vendor out of the part number over a generic tagging", () => {
        const url = getPartUrl(metadata({ partNumber: "TTB-0016" }), [
            Vendor.WCP,
            Vendor.TTB
        ]);
        expect(url).toBe(
            "https://www.thethriftybot.com/search?type=product&q=TTB-0016"
        );
    });

    it("prefers the record's own vendor over the insertable's", () => {
        const url = getPartUrl(
            metadata({ vendor: "McMaster-Carr", partNumber: "91251A445" }),
            [Vendor.WCP]
        );
        expect(url).toBe("https://www.mcmaster.com/91251A445/");
    });
});

describe("getVisibleOptions", () => {
    // Only the last three sizes are restricted, to the heavy style; nothing is
    // said about s1 and s2.
    const style = enumParam("style", ["light", "heavy"]);
    const size = enumParam("size", ["s1", "s2", "s3", "s4", "s5"], {
        optionConditions: [
            {
                type: OptionVisibilityType.RANGE,
                start: "s3",
                end: "s5",
                condition: {
                    type: VisibilityType.EQUAL,
                    id: "style",
                    value: "heavy"
                }
            }
        ]
    });
    const params: ConfigurationParameter[] = [size, style];

    it("offers every option when nothing is conditioned", () => {
        const plain = enumParam("plain", ["a", "b"]);
        expect(getVisibleOptions(plain, {}, [plain])).toHaveLength(2);
    });

    // The panel drops an enum with no options left, so reading the conditions
    // as a list of what may be shown took the whole parameter off the screen.
    it("keeps the options no condition names", () => {
        const visible = getVisibleOptions(size, { style: "light" }, params);
        expect(visible.map((option) => option.id)).toEqual(["s1", "s2"]);
    });

    it("adds the restricted options once their condition holds", () => {
        const visible = getVisibleOptions(size, { style: "heavy" }, params);
        expect(visible.map((option) => option.id)).toEqual([
            "s1",
            "s2",
            "s3",
            "s4",
            "s5"
        ]);
    });

    it("hides an option every condition naming it rejects", () => {
        const either = enumParam("either", ["a", "b"], {
            optionConditions: [
                {
                    type: OptionVisibilityType.LIST,
                    controlledOptions: ["b"],
                    condition: {
                        type: VisibilityType.EQUAL,
                        id: "style",
                        value: "heavy"
                    }
                },
                {
                    type: OptionVisibilityType.LIST,
                    controlledOptions: ["b"],
                    condition: {
                        type: VisibilityType.EQUAL,
                        id: "style",
                        value: "light"
                    }
                }
            ]
        });
        const withStyle = [either, style];
        // Either condition is enough to offer it.
        expect(
            getVisibleOptions(either, { style: "light" }, withStyle)
        ).toHaveLength(2);
        expect(
            getVisibleOptions(either, { style: "other" }, withStyle)
        ).toHaveLength(1);
    });
});

describe("evaluateCondition", () => {
    // The parser drops children it cannot represent, so a logical can arrive
    // holding none — and an OR of nothing reads as never.
    it.each([LogicalOp.AND, LogicalOp.OR])(
        "shows a parameter whose %s condition holds no children",
        (operation) => {
            expect(
                evaluateCondition(
                    { type: VisibilityType.LOGICAL, operation, children: [] },
                    {},
                    []
                )
            ).toBe(true);
        }
    );
});
