import { describe, expect, it } from "vitest";
import { Vendor, getVendorPartUrl, toVendor } from "./vendors";

describe("getVendorPartUrl", () => {
    it("lowercases the part number for WCP, whose urls are lowercase", () => {
        expect(getVendorPartUrl(Vendor.WCP, "WCP-1025")).toBe(
            "https://wcproducts.com/products/wcp-1025"
        );
    });

    it("keeps McMaster's part number as it is written", () => {
        expect(getVendorPartUrl(Vendor.MCM, "91251A445")).toBe(
            "https://www.mcmaster.com/91251A445/"
        );
    });

    it.each([Vendor.AM, Vendor.REV, Vendor.CUSTOM])(
        "has no derivable page for %s",
        (vendor) => {
            expect(getVendorPartUrl(vendor, "12345")).toBeUndefined();
        }
    );

    it("has nothing to build from without a part number", () => {
        expect(getVendorPartUrl(Vendor.WCP, undefined)).toBeUndefined();
    });
});

describe("toVendor", () => {
    it.each([
        ["WCP", Vendor.WCP],
        ["custom", Vendor.CUSTOM],
        ["West Coast Products", Vendor.WCP],
        ["  mcmaster-carr ", Vendor.MCM],
        ["Acme", undefined],
        ["", undefined],
        [undefined, undefined]
    ])("resolves %s", (text, expected) => {
        expect(toVendor(text)).toBe(expected);
    });
});

describe("Vendor", () => {
    it("lists Custom last, since it is the absence of a vendor", () => {
        const vendors = Object.values(Vendor);
        expect(vendors[vendors.length - 1]).toBe(Vendor.CUSTOM);
    });
});
