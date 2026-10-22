import { describe, expect, it } from "vitest";
import {
    type ConfigurationParameter,
    ParameterType
} from "../configurations/contract";
import { Vendor } from "../library/vendors";
import { NUT_MANIFEST } from "../../../__test_utils__/generated-fixtures";
import { describeMismatch, generatedConfiguration } from "./records";
import { releasedStudio, toGeneratedStudio } from "./manifest";

const released = releasedStudio(NUT_MANIFEST, {
    set: "fasteners",
    key: "nut",
    manifestElementId: "manifest"
});
const nut = toGeneratedStudio(released);

function withType(
    change: (type: ConfigurationParameter) => ConfigurationParameter
): ConfigurationParameter[] {
    return nut.parameters.map((parameter) =>
        parameter.id === "type" ? change(parameter) : parameter
    );
}

describe("describeMismatch", () => {
    it("accepts the generated configuration", () => {
        expect(
            describeMismatch(nut, nut.parameters, released.records)
        ).toBeUndefined();
    });

    it("accepts conditions Onshape spells differently but which show the same", () => {
        const reordered = withType((type) =>
            type.type === ParameterType.ENUM
                ? {
                      ...type,
                      optionConditions: [...type.optionConditions].reverse()
                  }
                : type
        );
        expect(
            describeMismatch(nut, reordered, released.records)
        ).toBeUndefined();
    });

    it("refuses another default, or options shown where nothing is made", () => {
        expect(
            describeMismatch(
                nut,
                withType((type) => ({ ...type, default: "HEX" })),
                released.records
            )
        ).toMatch(/inputs/);
        const unconditioned = withType((type) =>
            type.type === ParameterType.ENUM
                ? { ...type, optionConditions: [] }
                : type
        );
        expect(describeMismatch(nut, unconditioned, released.records)).toMatch(
            /offers/
        );
    });

    it("refuses parts the configuration doesn't offer", () => {
        expect(
            describeMismatch(nut, nut.parameters, released.records.slice(1))
        ).toMatch(/offers/);
    });
});

describe("generatedConfiguration", () => {
    it("is the default's part, every other configuration's, and their vendors", () => {
        const generated = generatedConfiguration(
            nut,
            nut.parameters,
            released.records
        );
        expect(generated.partMetadata.name).toBe("#10-32 Nylock Nut");
        // The default is the element's own part, not one of its records
        expect(
            generated.records.some(
                (record) =>
                    record.values.vendor === "GENERIC" &&
                    record.values.size === "NO_10_32" &&
                    record.values.type === "NYLOCK"
            )
        ).toBe(false);
        expect(generated.records).toHaveLength(released.records.length - 1);
        expect(generated.vendors).toEqual([Vendor.MCM]);
        expect(
            generated.records.find(
                (record) =>
                    record.values.vendor === "MCMASTER" &&
                    record.values.size === "NO_10_32" &&
                    record.values.type === "NYLOCK"
            )?.partNumber
        ).toBe("90631A411");
    });
});
