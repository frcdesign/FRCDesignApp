import { describe, expect, it } from "vitest";
import type { ElementPath } from "@backend/lib/onshape/path";
import { PresetId, presetCall } from "./presets";
import { limitHeaderLines } from "./rate-limit";

const PART_STUDIO: ElementPath = {
    documentId: "d1",
    instanceType: "w",
    instanceId: "w1",
    elementId: "ps"
};
const ASSEMBLY: ElementPath = { ...PART_STUDIO, elementId: "asm" };

describe("presetCall", () => {
    it("evaluates the script in the Part Studio, as Auto Assembly does", () => {
        expect(
            presetCall(
                PresetId.EVALUATE_FEATURESCRIPT,
                { partStudio: PART_STUDIO, assembly: ASSEMBLY },
                "script"
            )
        ).toEqual({
            method: "POST",
            version: 17,
            path: "/partstudios/d/d1/w/w1/e/ps/featurescript",
            body: { script: "script" }
        });
    });

    it("reads the assembly from the assembly's url", () => {
        expect(
            presetCall(
                PresetId.ASSEMBLY_FEATURES,
                { partStudio: PART_STUDIO, assembly: ASSEMBLY },
                ""
            )?.path
        ).toBe("/assemblies/d/d1/w/w1/e/asm/features");
    });

    it("needs the url its call is against, but session info needs none", () => {
        expect(
            presetCall(
                PresetId.ASSEMBLY_DEFINITION,
                { partStudio: PART_STUDIO },
                ""
            )
        ).toBeUndefined();
        expect(presetCall(PresetId.SESSION_INFO, {}, "")?.path).toBe(
            "/users/sessioninfo"
        );
        expect(
            presetCall(PresetId.DOCUMENT_ELEMENTS, { assembly: ASSEMBLY }, "")
                ?.path
        ).toBe("/documents/d/d1/w/w1/elements");
    });
});

describe("limitHeaderLines", () => {
    it("keeps the headers that look like a limit's, sorted by name", () => {
        expect(
            limitHeaderLines({
                "x-rate-limit-remaining": "99",
                "content-type": "application/json",
                "retry-after": "30",
                "x-rate-limit-limit": "100"
            })
        ).toEqual([
            "retry-after: 30",
            "x-rate-limit-limit: 100",
            "x-rate-limit-remaining: 99"
        ]);
    });
});
