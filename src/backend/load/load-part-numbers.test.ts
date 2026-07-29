import { afterEach, describe, expect, it, vi } from "vitest";
import {
    batchConfigurations,
    computePartNumbers,
    mergePartNumbers
} from "./load-part-numbers";
import * as PartsEndpoints from "../onshape-api/endpoints/parts";
import { OnshapeApi } from "../onshape-api/onshape-api";
import { ElementPath } from "../../shared/onshape-path";
import {
    Configuration,
    EnumParameterObj,
    ParameterObj,
    ParameterType
} from "../../shared/configuration-models";
import { ElementType } from "../../shared/types";
import { BuildIssueType } from "../../shared/build-checker";

const PATH: ElementPath = {
    documentId: "d",
    instanceId: "v",
    instanceType: "v",
    elementId: "e"
};

/** The client is only forwarded to the endpoint wrapper, which is mocked. */
const CLIENT = {} as OnshapeApi;

function enumParam(id: string, optionIds: string[]): EnumParameterObj {
    return {
        id,
        name: id,
        default: optionIds[0],
        isCosmetic: false,
        type: ParameterType.ENUM,
        options: optionIds.map((o) => ({ id: o, name: o })),
        optionConditions: []
    };
}

/**
 * Mocks the parts endpoint so the part number is derived from the requested
 * configuration. An empty configuration is the element's defaults.
 */
function mockParts(
    partNumberFor: (configuration: Configuration) => string | undefined
) {
    return vi
        .spyOn(PartsEndpoints, "getParts")
        .mockImplementation((_client, _path, configuration) =>
            Promise.resolve([
                { partId: "p", partNumber: partNumberFor(configuration) }
            ])
        );
}

afterEach(() => vi.restoreAllMocks());

describe("computePartNumbers", () => {
    it("dedupes configurations resolving to the same part number (first-wins)", async () => {
        const params: ParameterObj[] = [
            enumParam("A", ["a1", "a2"]),
            enumParam("B", ["b1", "b2"])
        ];
        // The part number depends only on A, so the two B values collapse.
        mockParts((configuration) => `PN-${configuration.A ?? "default"}`);

        const result = await computePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            params
        );

        expect(result.buildIssues).toEqual([]);
        expect(result.partNumbers).toEqual({
            "PN-a1": { A: "a1", B: "b1" },
            "PN-a2": { A: "a2", B: "b1" }
        });
    });

    it("records the default configuration's part number even when configurable", async () => {
        mockParts((configuration) => `PN-${configuration.A ?? "default"}`);

        const result = await computePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [enumParam("A", ["a1", "a2"])]
        );

        expect(result.defaultPartNumber).toBe("PN-default");
    });

    it("drops configurations with no part number", async () => {
        mockParts((configuration) =>
            configuration.A === "a1" ? "PN-a1" : undefined
        );

        const result = await computePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            [enumParam("A", ["a1", "a2"])]
        );

        expect(result.partNumbers).toEqual({ "PN-a1": { A: "a1" } });
    });

    it("stores the default part number for non-configurable insertables", async () => {
        mockParts(() => "PN-default");

        const result = await computePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            []
        );

        expect(result.defaultPartNumber).toBe("PN-default");
        expect(result.partNumbers).toEqual({});
    });

    it("flags capped enumeration but still records the default", async () => {
        // 2^10 = 1024 combinations, past MAX_PART_NUMBER_CONFIGURATIONS.
        const params: ParameterObj[] = Array.from({ length: 10 }, (_, i) =>
            enumParam(`P${i}`, ["x", "y"])
        );
        mockParts(() => "PN-default");

        const result = await computePartNumbers(
            CLIENT,
            PATH,
            ElementType.PART_STUDIO,
            params
        );

        expect(result.buildIssues).toEqual([
            { type: BuildIssueType.TOO_MANY_CONFIGURATIONS }
        ]);
        expect(result.partNumbers).toEqual({});
        expect(result.defaultPartNumber).toBe("PN-default");
    });
});

describe("batchConfigurations", () => {
    const configurations = [{ A: "1" }, { A: "2" }, { A: "3" }, { A: "4" }];

    it("splits into full batches", () => {
        expect(batchConfigurations(configurations, 2)).toEqual([
            [{ A: "1" }, { A: "2" }],
            [{ A: "3" }, { A: "4" }]
        ]);
    });

    it("leaves a partial final batch", () => {
        expect(batchConfigurations(configurations, 3)).toEqual([
            [{ A: "1" }, { A: "2" }, { A: "3" }],
            [{ A: "4" }]
        ]);
    });

    it("returns one batch when the size exceeds the count", () => {
        expect(batchConfigurations(configurations, 100)).toEqual([
            configurations
        ]);
    });

    it("returns no batches for no configurations", () => {
        expect(batchConfigurations([], 20)).toEqual([]);
    });
});

describe("mergePartNumbers", () => {
    it("merges entries across batches", () => {
        expect(
            mergePartNumbers([
                [{ partNumber: "PN-1", configuration: { A: "1" } }],
                [{ partNumber: "PN-2", configuration: { A: "2" } }]
            ])
        ).toEqual({ "PN-1": { A: "1" }, "PN-2": { A: "2" } });
    });

    it("keeps the first configuration for a repeated part number", () => {
        expect(
            mergePartNumbers([
                [
                    { partNumber: "PN-1", configuration: { A: "1" } },
                    { partNumber: "PN-1", configuration: { A: "2" } }
                ],
                [{ partNumber: "PN-1", configuration: { A: "3" } }]
            ])
        ).toEqual({ "PN-1": { A: "1" } });
    });

    it("returns an empty map for no batches", () => {
        expect(mergePartNumbers([])).toEqual({});
    });
});
