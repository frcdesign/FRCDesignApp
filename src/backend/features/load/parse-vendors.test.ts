import { describe, expect, it } from "vitest";
import { Vendor } from "../library/vendors";
import { ParameterType } from "../configurations/models";
import { QuantityType, Unit } from "../configurations/enums";
import {
    parseNameVendor,
    parseRecordVendor,
    parseVendors
} from "./parse-vendors";

describe("parseNameVendor", () => {
    it("detects vendor token in element name", () => {
        expect(parseNameVendor("REV Robotics Swerve")).toBe(Vendor.REV);
    });

    it("is case-insensitive", () => {
        expect(parseNameVendor("rev something")).toBe(Vendor.REV);
        expect(parseNameVendor("WCP Drive Module")).toBe(Vendor.WCP);
    });

    it("returns undefined when no vendor token is present", () => {
        expect(parseNameVendor("Generic Swerve Module")).toBeUndefined();
    });

    it("detects Redux despite mixed case enum value", () => {
        expect(parseNameVendor("REDUX module")).toBe(Vendor.REDUX);
    });
});

describe("parseVendors", () => {
    it("returns vendor from name when name contains a vendor token", () => {
        expect(parseVendors("REV swerve module", [])).toEqual([Vendor.REV]);
    });

    it("returns empty array when name has no vendor and no parameters", () => {
        expect(parseVendors("Generic Part", [])).toEqual([]);
    });

    it("falls back to enum option names when no name vendor found", () => {
        const parameters = [
            {
                type: ParameterType.ENUM as const,
                id: "vendor",
                name: "Vendor",
                isCosmetic: false,
                default: "wcp",
                condition: undefined,
                optionConditions: [],
                options: [
                    { id: "wcp", name: "WCP" },
                    { id: "rev", name: "REV" }
                ]
            }
        ];
        const result = parseVendors("Swerve Module", parameters);
        expect(result).toContain(Vendor.WCP);
        expect(result).toContain(Vendor.REV);
    });

    it("detects vendor by full name in enum options", () => {
        const parameters = [
            {
                type: ParameterType.ENUM as const,
                id: "vendor",
                name: "Vendor",
                isCosmetic: false,
                default: "am",
                condition: undefined,
                optionConditions: [],
                options: [{ id: "am", name: "AndyMark" }]
            }
        ];
        const result = parseVendors("Swerve Module", parameters);
        expect(result).toContain(Vendor.AM);
    });

    it("skips non-ENUM parameters", () => {
        const parameters = [
            {
                type: ParameterType.QUANTITY as const,
                id: "length",
                name: "Length",
                isCosmetic: false,
                default: "10 mm",
                condition: undefined,
                quantityType: QuantityType.LENGTH,
                defaultValue: 10,
                min: 0,
                max: 100,
                unit: Unit.MILLIMETER
            }
        ];
        expect(parseVendors("Generic Part", parameters)).toEqual([]);
    });

    // Custom marks a part nobody sells, so a missing part number is expected
    // rather than a warning. The name is the only thing that sets it.
    it("reads Custom out of a name, whatever its case", () => {
        expect(parseVendors("Custom Bracket", [])).toEqual([Vendor.CUSTOM]);
        expect(parseVendors("CUSTOM gusset", [])).toEqual([Vendor.CUSTOM]);
    });

    it("does not read Custom out of an unrelated word", () => {
        expect(parseVendors("Customizable Spacer", [])).toEqual([]);
    });
});

const vendorParameter = {
    id: "vendor",
    name: "Vendor",
    default: "wcp",
    isCosmetic: false,
    type: ParameterType.ENUM as const,
    options: [
        { id: "wcp", name: "West Coast Products" },
        { id: "am", name: "AndyMark" }
    ],
    optionConditions: []
};

describe("parseRecordVendor", () => {
    it("reads the selected option, by its full name", () => {
        expect(
            parseRecordVendor("Bearing", { vendor: "am" }, [vendorParameter])
        ).toBe(Vendor.AM);
    });

    it("reads a default selection, which is still a selection", () => {
        expect(
            parseRecordVendor("Bearing", { vendor: "wcp" }, [vendorParameter])
        ).toBe(Vendor.WCP);
    });

    it("treats an absent value as the parameter's default", () => {
        expect(parseRecordVendor("Bearing", {}, [vendorParameter])).toBe(
            Vendor.WCP
        );
    });

    it("prefers the selection over the part's own name", () => {
        expect(
            parseRecordVendor("REV Bearing", { vendor: "am" }, [
                vendorParameter
            ])
        ).toBe(Vendor.AM);
    });

    it("falls back to the part name when nothing is selected", () => {
        expect(parseRecordVendor("WCP-1025 Gearbox", {}, [])).toBe(Vendor.WCP);
    });

    it("reads a vendor off a part name that is only a part number", () => {
        expect(parseRecordVendor("WCP-1025", {}, [])).toBe(Vendor.WCP);
    });

    it("has none when neither names a vendor", () => {
        expect(parseRecordVendor("Generic Bearing", {}, [])).toBeUndefined();
    });

    it("has none without a part name", () => {
        expect(parseRecordVendor(undefined, {}, [])).toBeUndefined();
    });
});
