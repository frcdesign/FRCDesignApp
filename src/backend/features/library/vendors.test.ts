import { describe, expect, it } from "vitest";
import {
    Vendor,
    getLibraryVendors,
    getVendorName,
    getVendorPartUrl,
    parseVendor
} from "./vendors";
import { LibraryId } from "./library-id";

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
        [
            Vendor.GB,
            "2305-0025-0040",
            "https://www.gobilda.com/search-results-page?q=2305-0025-0040"
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

    it.each([Vendor.SDS, Vendor.VEX, Vendor.MIS, Vendor.CUSTOM])(
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
        ["goBILDA", Vendor.GB],
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

describe("getLibraryVendors", () => {
    it("stocks each library with its own list", () => {
        const ftc = getLibraryVendors(LibraryId.FTC_DESIGN_LIB);
        const frc = getLibraryVendors(LibraryId.FRC_DESIGN_LIB);

        expect(ftc).toContain(Vendor.GB);
        expect(frc).not.toContain(Vendor.GB);
        expect(frc).toContain(Vendor.TTB);
        expect(ftc).not.toContain(Vendor.TTB);
        // Shared by both, being where every team buys hardware.
        expect(ftc).toContain(Vendor.MCM);
        expect(frc).toContain(Vendor.MCM);
    });

    // The roster itself, so a vendor cannot quietly go missing: FRC teams see
    // this list and nothing else, in this order.
    it("stocks FRC with exactly the vendors it buys from", () => {
        expect(
            getLibraryVendors(LibraryId.FRC_DESIGN_LIB).map((vendor) => [
                getVendorName(vendor),
                vendor
            ])
        ).toEqual([
            ["AndyMark", "AM"],
            ["ARMABOT", "AB"],
            ["CTR Electronics", "CTRE"],
            ["IMI Norgren", "Norgren"],
            ["Last Anvil Innovations", "LAI"],
            ["McMaster-Carr", "MCM"],
            ["Parker", "Parker"],
            ["Redux Robotics", "Redux"],
            ["REV Robotics", "REV"],
            ["Swerve Drive Specialties", "SDS"],
            ["SWYFT Robotics", "SWYFT"],
            ["The Thrifty Bot", "TTB"],
            ["VEXpro", "VEX"],
            ["West Coast Products", "WCP"],
            ["Custom", "Custom"]
        ]);
    });

    // The same roster check for FTC, whose list is its own and shares only
    // part of FRC's.
    it("stocks FTC with exactly the vendors it buys from", () => {
        expect(
            getLibraryVendors(LibraryId.FTC_DESIGN_LIB).map((vendor) => [
                getVendorName(vendor),
                vendor
            ])
        ).toEqual([
            ["AndyMark", "AM"],
            ["Axon Robotics", "AXN"],
            ["Bsrkrbotics", "BSRKR"],
            ["BWTLink", "BWT"],
            ["East Loop Components", "ELC"],
            ["Ferra Components", "Ferra"],
            ["goBILDA", "GB"],
            ["MATA Robotics", "MATA"],
            ["McMaster-Carr", "MCM"],
            ["Melonbotics", "MB"],
            ["Misumi", "MIS"],
            ["Offset Robotics", "OS"],
            ["Redux Robotics", "Redux"],
            ["REV Robotics", "REV"],
            ["Sensorange", "SO"],
            ["SWYFT Robotics", "SWYFT"],
            ["VEXpro", "VEX"],
            ["West Coast Products", "WCP"],
            ["Custom", "Custom"]
        ]);
    });

    it("gives MKCad the FRC list, being an FRC library", () => {
        expect(getLibraryVendors(LibraryId.MKCAD)).toEqual(
            getLibraryVendors(LibraryId.FRC_DESIGN_LIB)
        );
    });

    it("ends every list with Custom", () => {
        for (const libraryId of Object.values(LibraryId)) {
            const vendors = getLibraryVendors(libraryId);
            expect(vendors[vendors.length - 1]).toBe(Vendor.CUSTOM);
        }
    });
});
