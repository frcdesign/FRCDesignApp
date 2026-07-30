import { describe, expect, it } from "vitest";
import type { OnshapeAssemblyDefinition } from "../onshape-api/onshape-types";
import {
    normalizePartNumber,
    parseAssemblyPartNumber,
    parsePartStudioPartNumber
} from "./parse-part-number";

/** A minimal assembly definition carrying the given root part number. */
function assembly(partNumber?: string): OnshapeAssemblyDefinition {
    return {
        rootAssembly: { features: [], instances: [], partNumber },
        parts: [],
        subAssemblies: []
    };
}

describe("normalizePartNumber", () => {
    it("trims surrounding whitespace", () => {
        expect(normalizePartNumber("  217-2600 ")).toBe("217-2600");
    });

    it("maps missing or blank values to null", () => {
        expect(normalizePartNumber(undefined)).toBeNull();
        expect(normalizePartNumber(null)).toBeNull();
        expect(normalizePartNumber("")).toBeNull();
        expect(normalizePartNumber("   ")).toBeNull();
    });
});

describe("parsePartStudioPartNumber", () => {
    it("returns the part number of the studio's part", () => {
        expect(
            parsePartStudioPartNumber([
                { partId: "JHD", partNumber: "217-2600" }
            ])
        ).toBe("217-2600");
    });

    it("skips parts without a part number", () => {
        expect(
            parsePartStudioPartNumber([
                { partId: "JHD" },
                { partId: "JHE", partNumber: "  217-2601  " }
            ])
        ).toBe("217-2601");
    });

    it("returns null when no part carries a part number", () => {
        expect(
            parsePartStudioPartNumber([
                { partId: "JHD" },
                { partId: "JHE", partNumber: "  " }
            ])
        ).toBeNull();
    });

    it("returns null for an empty response", () => {
        expect(parsePartStudioPartNumber([])).toBeNull();
    });
});

describe("parseAssemblyPartNumber", () => {
    it("returns the root assembly's part number", () => {
        expect(parseAssemblyPartNumber(assembly(" AM-1234 "))).toBe("AM-1234");
    });

    it("returns null when the assembly has no part number", () => {
        expect(parseAssemblyPartNumber(assembly())).toBeNull();
        expect(parseAssemblyPartNumber(assembly(""))).toBeNull();
    });

    it("returns null for a malformed response", () => {
        expect(parseAssemblyPartNumber(undefined)).toBeNull();
        expect(
            parseAssemblyPartNumber({} as OnshapeAssemblyDefinition)
        ).toBeNull();
    });
});
