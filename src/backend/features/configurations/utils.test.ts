import { describe, expect, it } from "vitest";
import {
    decodeConfiguration,
    encodeConfiguration,
    findRecordForConfiguration,
    getPartUrl
} from "./utils";
import { PartMetadata, SearchRecord } from "./models";
import { Vendor } from "../library/vendors";

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
