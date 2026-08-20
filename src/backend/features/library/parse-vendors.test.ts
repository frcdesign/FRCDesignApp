import { describe, expect, it } from "vitest";
import { Vendor } from "./vendors";
import { ParameterType } from "../configurations/models";
import { QuantityType, Unit } from "../configurations/enums";
import { parseNameVendor, parseVendors } from "./parse-vendors";

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
