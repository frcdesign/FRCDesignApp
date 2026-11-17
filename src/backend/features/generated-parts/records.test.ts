import { describe, expect, it } from "vitest";
import { Vendor } from "../library/vendors";
import { NUT_MANIFEST } from "../../../__test_utils__/generated-fixtures";
import { parseOnshapeConfiguration } from "../load/parse-configuration";
import { type OnshapeConfigurationResponse } from "../../lib/onshape/types";
import { generatedConfiguration } from "./records";
import { releasedStudio } from "./manifest";

const released = releasedStudio(NUT_MANIFEST, {
    set: "fasteners",
    key: "nut",
    manifestElementId: "manifest"
});
// The tab's configuration, as robot-code writes it and Onshape answers it
const parameters = parseOnshapeConfiguration({
    ...NUT_MANIFEST.studios.nut.configuration,
    btType: "BTConfigurationResponse-2019"
} as unknown as OnshapeConfigurationResponse);

describe("generatedConfiguration", () => {
    it("is the default's part, every other configuration's, and their vendors", () => {
        const generated = generatedConfiguration(parameters, released.records);
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
