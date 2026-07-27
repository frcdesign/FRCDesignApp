import { describe, expect, it } from "vitest";
import {
    batchConfigurations,
    computePartNumbers,
    mergePartNumbers
} from "./load-part-numbers";
import { OnshapeApi } from "../onshape-api/onshape-api";
import { ElementPath } from "../../shared/onshape-path";
import {
    EnumParameterObj,
    ParameterObj,
    ParameterType
} from "../../shared/configuration-models";
import { ElementType } from "../../shared/types";

const PATH: ElementPath = {
    documentId: "d",
    instanceId: "v",
    instanceType: "v",
    elementId: "e"
};

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

/** A fake client whose returned part number is derived from the configuration. */
function fakeClient(
    partNumberFor: (configuration: string) => string | undefined
): OnshapeApi {
    return {
        get: (
            _path: string,
            options?: { query?: { configuration?: string } }
        ) =>
            Promise.resolve([
                {
                    partId: "p",
                    partNumber: partNumberFor(
                        options?.query?.configuration ?? ""
                    )
                }
            ])
    } as unknown as OnshapeApi;
}

describe("computePartNumbers", () => {
    it("dedupes configurations resolving to the same part number (first-wins)", async () => {
        const params: ParameterObj[] = [
            enumParam("A", ["a1", "a2"]),
            enumParam("B", ["b1", "b2"])
        ];
        // Part number depends only on A, so the two B values collapse.
        const client = fakeClient((configuration) => {
            const a = /A=([^;]*)/.exec(configuration)?.[1];
            return a ? `PN-${a}` : undefined;
        });

        const result = await computePartNumbers(
            client,
            PATH,
            ElementType.PART_STUDIO,
            params
        );

        expect(result.capped).toBe(false);
        expect(result.defaultPartNumber).toBeNull();
        expect(result.partNumbers).toEqual({
            "PN-a1": { A: "a1", B: "b1" },
            "PN-a2": { A: "a2", B: "b1" }
        });
    });

    it("drops configurations with no part number", async () => {
        const params: ParameterObj[] = [enumParam("A", ["a1", "a2"])];
        const client = fakeClient((configuration) =>
            configuration.includes("A=a1") ? "PN-a1" : undefined
        );

        const result = await computePartNumbers(
            client,
            PATH,
            ElementType.PART_STUDIO,
            params
        );

        expect(result.partNumbers).toEqual({ "PN-a1": { A: "a1" } });
    });

    it("stores the default part number for non-configurable insertables", async () => {
        const client = fakeClient(() => "PN-default");

        const result = await computePartNumbers(
            client,
            PATH,
            ElementType.PART_STUDIO,
            []
        );

        expect(result.defaultPartNumber).toBe("PN-default");
        expect(result.partNumbers).toEqual({});
    });

    it("reports capped enumeration without building a map", async () => {
        const params: ParameterObj[] = [
            enumParam("A", ["a1", "a2"]),
            enumParam("B", ["b1", "b2"]),
            enumParam("C", ["c1", "c2"])
        ];
        const client = fakeClient(() => "PN");

        const result = await computePartNumbers(
            client,
            PATH,
            ElementType.PART_STUDIO,
            params,
            4
        );

        expect(result.capped).toBe(true);
        expect(result.partNumbers).toEqual({});
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
