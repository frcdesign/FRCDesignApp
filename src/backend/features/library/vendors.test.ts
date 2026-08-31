import { describe, expect, it } from "vitest";
import { Vendor, getVendorPartUrl, parseVendor } from "./vendors";

describe("getVendorPartUrl", () => {
    // Each vendor writes its own casing, and only some have a per-part page.
    it.each([
        [Vendor.WCP, "WCP-1025", "https://wcproducts.com/products/wcp-1025"],
        [Vendor.MCM, "91251A445", "https://www.mcmaster.com/91251A445/"],
        [
            Vendor.AM,
            "AM-5833",
            "https://andymark.com/pages/search-results-page?q=am-5833"
        ],
        [
            Vendor.REV,
            "REV-42-1442",
            "https://www.revrobotics.com/search.php?search_query=REV-42-1442&section=product"
        ],
        [
            Vendor.TTB,
            "TTB-0008",
            "https://www.thethriftybot.com/search?type=product&q=TTB-0008"
        ],
        // Escaped, since a part number can carry url syntax.
        [
            Vendor.TTB,
            "TTB 1&2",
            "https://www.thethriftybot.com/search?type=product&q=TTB%201%262"
        ]
    ])("builds %s's url for %s", (vendor, partNumber, url) => {
        expect(getVendorPartUrl(vendor, partNumber)).toBe(url);
    });

    it.each([Vendor.SDS, Vendor.VEX, Vendor.CUSTOM])(
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
        expect(parseVendor(text)).toBe(expected);
    });
});

describe("Vendor", () => {
    it("lists Custom last, since it is the absence of a vendor", () => {
        const vendors = Object.values(Vendor);
        expect(vendors[vendors.length - 1]).toBe(Vendor.CUSTOM);
    });
});
