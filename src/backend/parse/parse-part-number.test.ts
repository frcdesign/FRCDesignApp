import { afterEach, describe, expect, it, vi } from "vitest";
import type {
    OnshapeAssemblyDefinition,
    OnshapePart
} from "../onshape-api/onshape-types";
import * as PartsEndpoints from "../onshape-api/endpoints/parts";
import { OnshapeApi } from "../onshape-api/onshape-api";
import { ElementPath } from "../../shared/onshape-path";
import {
    ParameterValues,
    ConfigurationParameter
} from "../../shared/configuration-models";
import { enumParam } from "../../__test_utils__/configuration-fixtures";
import { ElementType } from "../../shared/types";
import { BuildIssueType } from "../../shared/build-issues";
import {
    computeOpenComposite,
    evaluateParts,
    normalizePartNumber,
    parseAssemblyPartNumber,
    parsePartNumbers,
    parsePartStudioParts
} from "./parse-part-number";

/** A minimal assembly definition carrying the given root part number. */
function assembly(partNumber?: string): OnshapeAssemblyDefinition {
    return {
        rootAssembly: { features: [], instances: [], partNumber },
        parts: [],
        subAssemblies: []
    };
}

const PATH: ElementPath = {
    documentId: "d",
    instanceId: "v",
    instanceType: "v",
    elementId: "e"
};

/** The client is only forwarded to the endpoint wrapper, which is mocked. */
const CLIENT = {} as OnshapeApi;

/**
 * Mocks the parts endpoint, deriving the studio's parts from the requested
 * configuration. An empty configuration is the element's defaults.
 */
function mockParts(
    partsFor: (configuration: ParameterValues) => OnshapePart[]
) {
    return vi
        .spyOn(PartsEndpoints, "getParts")
        .mockImplementation((_client, _path, configuration) =>
            Promise.resolve(partsFor(configuration))
        );
}

/** Mocks a single-part studio whose part number depends on the configuration. */
function mockPartNumbers(
    partNumberFor: (configuration: ParameterValues) => string | undefined
) {
    return mockParts((configuration) => [
        { partId: "p", partNumber: partNumberFor(configuration) }
    ]);
}

afterEach(() => vi.restoreAllMocks());

describe("normalizePartNumber", () => {
    it("trims surrounding whitespace", () => {
        expect(normalizePartNumber("  217-2600 ")).toBe("217-2600");
    });

    it("maps missing or blank values to null", () => {
        expect(normalizePartNumber(undefined)).toBeNull();
        expect(normalizePartNumber("")).toBeNull();
        expect(normalizePartNumber("   ")).toBeNull();
    });
});

describe("evaluateParts", () => {
    it("indexes the sole part of a normal single-part studio", () => {
        expect(
            evaluateParts([
                { partId: "p", partNumber: "PN-1", bodyType: "solid" }
            ])
        ).toEqual({
            hasMultipleParts: false,
            isOpenComposite: false,
            partToUse: { partId: "p", partNumber: "PN-1", bodyType: "solid" }
        });
    });

    it("flags multiple parts when a non-composite studio has more than one", () => {
        expect(
            evaluateParts([
                { partId: "p1", bodyType: "solid" },
                { partId: "p2", bodyType: "solid" }
            ])
        ).toMatchObject({ hasMultipleParts: true, isOpenComposite: false });
    });

    it("uses the composite and ignores the constituents of an open composite", () => {
        expect(
            evaluateParts([
                { partId: "c", partNumber: "PN-C", bodyType: "composite" },
                { partId: "p1", partNumber: "PN-1", bodyType: "solid" }
            ])
        ).toMatchObject({
            hasMultipleParts: false,
            isOpenComposite: true,
            partToUse: { partId: "c" }
        });
    });

    it("is not an open composite for a lone composite part", () => {
        expect(
            evaluateParts([{ partId: "c", bodyType: "composite" }])
                .isOpenComposite
        ).toBe(false);
    });

    it("flags multiple parts when more than one composite resolves", () => {
        expect(
            evaluateParts([
                { partId: "c1", bodyType: "composite" },
                { partId: "c2", bodyType: "composite" }
            ])
        ).toMatchObject({ hasMultipleParts: true, isOpenComposite: true });
    });
});

describe("computeOpenComposite", () => {
    it("reports whether the parts form an open composite", () => {
        expect(
            computeOpenComposite([
                { partId: "c", bodyType: "composite" },
                { partId: "p", bodyType: "solid" }
            ])
        ).toBe(true);
        expect(computeOpenComposite([{ partId: "p", bodyType: "solid" }])).toBe(
            false
        );
    });
});

describe("parsePartStudioParts", () => {
    it("reads the sole part's number for a normal studio", () => {
        expect(
            parsePartStudioParts(
                [{ partId: "JHD", partNumber: "  217-2600 " }],
                false
            )
        ).toEqual({
            partNumber: "217-2600",
            hasMultipleParts: false,
            isUnstableComposite: false
        });
    });

    it("reads the composite's number when the studio is an open composite", () => {
        expect(
            parsePartStudioParts(
                [
                    { partId: "c", partNumber: "PN-C", bodyType: "composite" },
                    { partId: "p", partNumber: "PN-1", bodyType: "solid" }
                ],
                true
            )
        ).toEqual({
            partNumber: "PN-C",
            hasMultipleParts: false,
            isUnstableComposite: false
        });
    });

    it("flags an unstable composite and indexes nothing when an expected composite is missing", () => {
        expect(
            parsePartStudioParts(
                [
                    { partId: "p1", partNumber: "PN-1", bodyType: "solid" },
                    { partId: "p2", partNumber: "PN-2", bodyType: "solid" }
                ],
                true
            )
        ).toEqual({
            partNumber: null,
            hasMultipleParts: false,
            isUnstableComposite: true
        });
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
});

describe("parsePartNumbers", () => {
    it("dedupes configurations resolving to the same part number (first-wins)", async () => {
        const params: ConfigurationParameter[] = [
            enumParam("A", ["a1", "a2"]),
            enumParam("B", ["b1", "b2"])
        ];
        // The part number depends only on A, so the two B values collapse.
        mockPartNumbers(
            (configuration) => `PN-${configuration.A ?? "default"}`
        );

        const result = await parsePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            params,
            false
        );

        expect(result.buildIssues).toEqual([]);
        expect(result.partNumbers).toEqual({
            "PN-a1": { A: "a1", B: "b1" },
            "PN-a2": { A: "a2", B: "b1" }
        });
    });

    it("records the default configuration's part number even when configurable", async () => {
        mockPartNumbers(
            (configuration) => `PN-${configuration.A ?? "default"}`
        );

        const result = await parsePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [enumParam("A", ["a1", "a2"])],
            false
        );

        expect(result.defaultPartNumber).toBe("PN-default");
    });

    it("drops configurations with no part number", async () => {
        mockPartNumbers((configuration) =>
            configuration.A === "a1" ? "PN-a1" : undefined
        );

        const result = await parsePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [enumParam("A", ["a1", "a2"])],
            false
        );

        expect(result.partNumbers).toEqual({ "PN-a1": { A: "a1" } });
    });

    it("stores the default part number for non-configurable insertables", async () => {
        const spy = mockPartNumbers(() => "PN-default");

        const result = await parsePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [],
            false
        );

        expect(result.defaultPartNumber).toBe("PN-default");
        expect(result.partNumbers).toEqual({});
        // Only the default probe; there are no combinations to enumerate.
        expect(spy).toHaveBeenCalledTimes(1);
    });

    // 20 configurations per batch, so this spans three of them. Batching is
    // internal, so assert every combination was still fetched exactly once.
    it("indexes every configuration across batch boundaries", async () => {
        const params: ConfigurationParameter[] = [
            enumParam("A", ["a1", "a2", "a3", "a4", "a5", "a6", "a7"]),
            enumParam("B", ["b1", "b2", "b3", "b4", "b5", "b6", "b7"])
        ];
        const spy = mockPartNumbers(
            (configuration) => `PN-${configuration.A}-${configuration.B}`
        );

        const result = await parsePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            params,
            false
        );

        expect(Object.keys(result.partNumbers)).toHaveLength(49);
        // 49 combinations plus the default probe.
        expect(spy).toHaveBeenCalledTimes(50);
    });

    it("flags capped enumeration but still records the default", async () => {
        // 2^10 = 1024 combinations, past MAX_PART_NUMBER_CONFIGURATIONS.
        const params: ConfigurationParameter[] = Array.from(
            { length: 10 },
            (_, i) => enumParam(`P${i}`, ["x", "y"])
        );
        mockPartNumbers(() => "PN-default");

        const result = await parsePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            params,
            false
        );

        expect(result.buildIssues).toEqual([
            { type: BuildIssueType.TOO_MANY_CONFIGURATIONS }
        ]);
        expect(result.partNumbers).toEqual({});
        expect(result.defaultPartNumber).toBe("PN-default");
    });

    it("flags a studio with more than one part in any configuration", async () => {
        mockParts((configuration) =>
            configuration.A === "a2"
                ? [
                      { partId: "p1", partNumber: "PN-1" },
                      { partId: "p2", partNumber: "PN-2" }
                  ]
                : [{ partId: "p1", partNumber: "PN-1" }]
        );

        const result = await parsePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [enumParam("A", ["a1", "a2"])],
            false
        );

        expect(result.buildIssues).toEqual([
            { type: BuildIssueType.MULTIPLE_PARTS }
        ]);
    });

    it("does not flag a single-part studio", async () => {
        mockParts(() => [{ partId: "p1", partNumber: "PN-1" }]);

        const result = await parsePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [enumParam("A", ["a1", "a2"])],
            false
        );

        expect(result.buildIssues).toEqual([]);
    });

    it("indexes an open composite from its composite part alone", async () => {
        mockParts((configuration) => [
            {
                partId: "c",
                partNumber: `PN-${configuration.A ?? "default"}`,
                bodyType: "composite"
            },
            { partId: "p1", partNumber: "loose-1", bodyType: "solid" },
            { partId: "p2", partNumber: "loose-2", bodyType: "solid" }
        ]);

        const result = await parsePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [enumParam("A", ["a1", "a2"])],
            true
        );

        expect(result.buildIssues).toEqual([]);
        expect(result.defaultPartNumber).toBe("PN-default");
        expect(result.partNumbers).toEqual({
            "PN-a1": { A: "a1" },
            "PN-a2": { A: "a2" }
        });
    });

    it("flags an unstable composite when a configuration loses its composite", async () => {
        mockParts((configuration) =>
            configuration.A === "a2"
                ? [
                      { partId: "p1", partNumber: "PN-1", bodyType: "solid" },
                      { partId: "p2", partNumber: "PN-2", bodyType: "solid" }
                  ]
                : [
                      {
                          partId: "c",
                          partNumber: "PN-C",
                          bodyType: "composite"
                      },
                      { partId: "p1", partNumber: "loose", bodyType: "solid" }
                  ]
        );

        const result = await parsePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [enumParam("A", ["a1", "a2"])],
            true
        );

        expect(result.buildIssues).toEqual([
            { type: BuildIssueType.UNSTABLE_COMPOSITE }
        ]);
        // Only the composite's number is indexed; the a2 loose parts are ignored.
        expect(result.partNumbers).toEqual({ "PN-C": { A: "a1" } });
    });

    it("indexes an assembly from its root part number", async () => {
        vi.spyOn(PartsEndpoints, "getAssemblyDefinition").mockResolvedValue(
            assembly("AM-1")
        );

        const result = await parsePartNumbers(
            CLIENT,
            PATH,
            ElementType.ASSEMBLY,
            [enumParam("A", ["a1", "a2"])],
            false
        );

        expect(result.buildIssues).toEqual([]);
        expect(result.defaultPartNumber).toBe("AM-1");
    });
});
