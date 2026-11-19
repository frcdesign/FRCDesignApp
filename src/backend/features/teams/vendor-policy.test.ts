import { describe, expect, it } from "vitest";
import { type EnumParameter, ParameterRole } from "../configurations/contract";
import { enumParam } from "../../../__test_utils__/configuration-fixtures";
import { readVendorOption, VendorOptionMatch } from "../library/vendor-options";
import { Vendor } from "../library/vendors";
import { GenericVendorPolicy } from "./contract";
import {
    applyVendorPreferences,
    offeredVendorParameter
} from "./vendor-policy";

/** A Vendor list of Generic, WCP and REV, defaulting to `defaultId`. */
function vendorParameter(defaultId = "rev"): EnumParameter {
    return {
        ...enumParam("vendor", []),
        name: "Vendor",
        default: defaultId,
        options: [
            { id: "generic", name: "Generic" },
            { id: "wcp", name: "West Coast Products" },
            { id: "rev", name: "REV Robotics" }
        ],
        role: ParameterRole.VENDOR
    };
}

function apply(
    generic: GenericVendorPolicy,
    value: string,
    { opening = true, ranking = [Vendor.WCP] } = {}
): string {
    const parameter = vendorParameter();
    return applyVendorPreferences(
        { vendor: value },
        [parameter],
        { ranking, generic },
        opening
    ).vendor;
}

describe("readVendorOption", () => {
    it.each([
        ["West Coast Products", VendorOptionMatch.EXACT],
        ["generic", VendorOptionMatch.GENERIC],
        ["WCP", VendorOptionMatch.ABBREVIATION],
        ["REV", VendorOptionMatch.ABBREVIATION],
        ["west coast products", VendorOptionMatch.MISSPELLED],
        ["McMaster", VendorOptionMatch.MISSPELLED],
        ["PARKER", VendorOptionMatch.MISSPELLED],
        ["Acme", VendorOptionMatch.UNKNOWN]
    ])("reads %s as %s", (option, match) => {
        expect(readVendorOption(option).match).toBe(match);
    });
});

describe("applyVendorPreferences", () => {
    it("holds every Vendor to Generic under Require, and off it under Ban", () => {
        expect(
            apply(GenericVendorPolicy.REQUIRE, "wcp", { opening: false })
        ).toBe("generic");
        expect(
            apply(GenericVendorPolicy.BAN, "generic", { opening: false })
        ).toBe("wcp");
        expect(apply(GenericVendorPolicy.BAN, "rev", { opening: false })).toBe(
            "rev"
        );
    });

    it("fills a Vendor left at its default only when opening", () => {
        expect(apply(GenericVendorPolicy.PREFER, "rev")).toBe("generic");
        expect(
            apply(GenericVendorPolicy.PREFER, "rev", { opening: false })
        ).toBe("rev");
        expect(apply(GenericVendorPolicy.ANY, "rev")).toBe("wcp");
        // Not at its default: somebody chose it, a favorite or a search hit.
        expect(apply(GenericVendorPolicy.PREFER, "wcp")).toBe("wcp");
    });

    it("avoids Generic for the best-ranked other, or the first with no ranking", () => {
        const parameter = vendorParameter("generic");
        const opened = (ranking: Vendor[]) =>
            applyVendorPreferences(
                { vendor: "generic" },
                [parameter],
                { ranking, generic: GenericVendorPolicy.AVOID },
                true
            ).vendor;
        expect(opened([Vendor.REV])).toBe("rev");
        expect(opened([])).toBe("wcp");
    });

    it("leaves the default where the ranking names none of the options", () => {
        expect(
            apply(GenericVendorPolicy.ANY, "rev", { ranking: [Vendor.VEX] })
        ).toBe("rev");
    });
});

describe("offeredVendorParameter", () => {
    it("hides a Vendor under Require, and drops Generic under Ban", () => {
        const parameter = vendorParameter();
        expect(
            offeredVendorParameter(parameter, GenericVendorPolicy.REQUIRE)
        ).toBeUndefined();
        const banned = offeredVendorParameter(
            parameter,
            GenericVendorPolicy.BAN
        ) as EnumParameter;
        expect(banned.options.map((option) => option.id)).toEqual([
            "wcp",
            "rev"
        ]);
        expect(
            offeredVendorParameter(parameter, GenericVendorPolicy.PREFER)
        ).toBe(parameter);
    });

    it("hides a Vendor where Ban leaves one option", () => {
        const parameter = {
            ...vendorParameter(),
            options: vendorParameter().options.slice(0, 2)
        };
        expect(
            offeredVendorParameter(parameter, GenericVendorPolicy.BAN)
        ).toBeUndefined();
    });
});
