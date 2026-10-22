import { describe, expect, it } from "vitest";
import {
    type ConfigurationParameter,
    ParameterType
} from "../configurations/contract";
import { Vendor } from "../library/vendors";
import { describeMismatch, generatedConfiguration } from "./records";
import { getGeneratedStudio } from "./studios";

const screw = getGeneratedStudio("fasteners", "screw")!;

function withLength(
    change: (length: ConfigurationParameter) => ConfigurationParameter
): ConfigurationParameter[] {
    return screw.parameters.map((parameter) =>
        parameter.id === "length" ? change(parameter) : parameter
    );
}

describe("describeMismatch", () => {
    it("accepts the generated configuration", () => {
        expect(describeMismatch(screw, screw.parameters)).toBeUndefined();
    });

    it("accepts conditions Onshape spells differently but which show the same", () => {
        const reordered = withLength((length) =>
            length.type === ParameterType.ENUM
                ? {
                      ...length,
                      optionConditions: [...length.optionConditions].reverse()
                  }
                : length
        );
        expect(describeMismatch(screw, reordered)).toBeUndefined();
    });

    it("refuses another default, or options shown where nothing is made", () => {
        expect(
            describeMismatch(
                screw,
                withLength((length) => ({ ...length, default: "IN_1" }))
            )
        ).toMatch(/inputs/);
        const unconditioned = withLength((length) =>
            length.type === ParameterType.ENUM
                ? { ...length, optionConditions: [] }
                : length
        );
        expect(describeMismatch(screw, unconditioned)).toMatch(/offers/);
    });
});

describe("generatedConfiguration", () => {
    it("is the default's part, every other configuration's, and their vendors", () => {
        const generated = generatedConfiguration(screw, screw.parameters);
        expect(generated.partMetadata.name).toBe(
            "#10-32 x 1/2 in. Button Head Screw"
        );
        // The default is the element's own part, not one of its records
        expect(
            generated.records.some(
                (record) =>
                    record.values.vendor === "GENERIC" &&
                    record.values.size === "NO_10_32" &&
                    record.values.head === "BUTTON" &&
                    record.values.length === "IN_0_5"
            )
        ).toBe(false);
        expect(generated.vendors).toEqual(
            expect.arrayContaining([
                Vendor.MCM,
                Vendor.REV,
                Vendor.WCP,
                Vendor.AM
            ])
        );
        expect(
            generated.records.find((record) => record.partNumber === "WCP-0135")
                ?.description
        ).toBe("https://wcproducts.com/products/wcp-0135");
    });
});
