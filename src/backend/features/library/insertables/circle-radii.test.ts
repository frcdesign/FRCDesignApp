import { afterEach, describe, expect, it, vi } from "vitest";
import * as AssemblyEndpoints from "../../../lib/onshape/endpoints/assemblies";
import * as PartsEndpoints from "../../../lib/onshape/endpoints/parts";
import { type OnshapeApi } from "../../../lib/onshape/client";
import { type ElementPath } from "../../../lib/onshape/path";
import { getCircleRadii } from "./circle-radii";

const API = {} as OnshapeApi;
const TARGET: ElementPath = {
    documentId: "d",
    instanceType: "w",
    instanceId: "w",
    elementId: "e"
};

const BRACKET = {
    documentId: "d-bracket",
    elementId: "e-bracket",
    documentMicroversion: "m-bracket",
    configuration: "size=large"
};

describe("getCircleRadii", () => {
    afterEach(() => vi.restoreAllMocks());

    it("finds a circle on a part inside a subassembly", async () => {
        vi.spyOn(AssemblyEndpoints, "getAssembly").mockResolvedValue({
            rootAssembly: {
                features: [],
                instances: [{ id: "sub", type: "Assembly", ...BRACKET }]
            },
            parts: [],
            subAssemblies: [
                {
                    ...BRACKET,
                    features: [],
                    instances: [
                        {
                            id: "plate",
                            type: "Part",
                            documentId: "d-plate",
                            elementId: "e-plate",
                            documentMicroversion: "m-plate",
                            configuration: "default",
                            partId: "JHD"
                        }
                    ]
                }
            ]
        });
        const bodyDetails = vi
            .spyOn(PartsEndpoints, "getPartBodyDetails")
            .mockResolvedValue({
                bodies: [
                    {
                        edges: [
                            { id: "JH1", curve: { radius: 0.002 } },
                            { id: "JH2", curve: { type: "LINE" } }
                        ]
                    }
                ]
            });

        const radii = await getCircleRadii(API, TARGET, [
            { selectionId: "JH1", occurrencePath: ["sub", "plate"] },
            { selectionId: "JH2", occurrencePath: ["sub", "plate"] },
            { selectionId: "JH1", occurrencePath: ["missing"] }
        ]);

        expect(radii).toEqual([0.002, undefined, undefined]);
        expect(bodyDetails).toHaveBeenCalledOnce();
        expect(bodyDetails).toHaveBeenCalledWith(
            API,
            {
                documentId: "d-plate",
                instanceType: "m",
                instanceId: "m-plate",
                elementId: "e-plate"
            },
            "JHD",
            undefined
        );
    });
});
