import { describe, expect, it } from "vitest";
import { OnshapeElementType } from "../../lib/onshape/types";
import {
    NUT_MANIFEST,
    NUT_TAB
} from "../../../__test_utils__/generated-fixtures";
import {
    findManifestTabs,
    GeneratedManifestError,
    generatedTabs,
    parseManifest,
    releasedStudio,
    setOf
} from "./manifest";

const tab = (name: string, elementType: OnshapeElementType) => ({
    id: name,
    name,
    elementType,
    microversionId: "m"
});

describe("findManifestTabs", () => {
    it("finds the file tabs named like a part set's manifest", () => {
        const manifest = tab("fasteners.parts.json", OnshapeElementType.BLOB);
        expect(
            findManifestTabs([
                manifest,
                tab("Screw", OnshapeElementType.PART_STUDIO),
                tab("fasteners.fs", OnshapeElementType.FEATURE_STUDIO),
                tab("notes.json", OnshapeElementType.BLOB)
            ])
        ).toEqual([manifest]);
        expect(setOf(manifest)).toBe("fasteners");
    });
});

describe("parseManifest", () => {
    it("reads a manifest's studios", () => {
        const manifest = parseManifest(
            JSON.stringify(NUT_MANIFEST),
            "fasteners.parts.json"
        );
        expect(generatedTabs(manifest, "fasteners", "manifest")).toEqual({
            [NUT_TAB]: {
                set: "fasteners",
                key: "nut",
                manifestElementId: "manifest"
            }
        });
        const nut = releasedStudio(manifest, {
            set: "fasteners",
            key: "nut",
            manifestElementId: "manifest"
        });
        expect(nut.feature).toBe("fastenerNut");
        expect(nut.records.length).toBeGreaterThan(0);
    });

    it("refuses what isn't JSON, or isn't a manifest", () => {
        expect(() => parseManifest("{", "fasteners.parts.json")).toThrow(
            GeneratedManifestError
        );
        expect(() =>
            parseManifest(
                JSON.stringify({
                    studios: { nut: { feature: "fastenerNut" } }
                }),
                "fasteners.parts.json"
            )
        ).toThrow(/isn't a part set's manifest/);
    });

    it("refuses a tab its manifest has no studio for", () => {
        const manifest = parseManifest(
            JSON.stringify(NUT_MANIFEST),
            "fasteners.parts.json"
        );
        expect(() =>
            releasedStudio(manifest, {
                set: "fasteners",
                key: "screw",
                manifestElementId: "manifest"
            })
        ).toThrow(/no studio screw/);
    });
});
