import { describe, expect, it } from "vitest";
import { computePartNumbers, nextWaveSize } from "./load-part-numbers";
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

describe("nextWaveSize", () => {
    it("packs as many leading jobs as fit within budget - reserve", () => {
        expect(nextWaveSize([2, 2, 2], 10, 0)).toBe(3);
    });

    it("stops before a job would exceed the usable budget", () => {
        expect(nextWaveSize([4, 4, 4], 10, 0)).toBe(2);
    });

    it("applies the reserve headroom", () => {
        expect(nextWaveSize([3, 3], 10, 5)).toBe(1);
    });

    it("runs an over-budget job alone rather than stalling", () => {
        expect(nextWaveSize([100], 10, 0)).toBe(1);
        expect(nextWaveSize([100, 1], 10, 0)).toBe(1);
    });

    it("never returns zero for a non-empty job list", () => {
        expect(nextWaveSize([50], 0, 20)).toBe(1);
    });
});
