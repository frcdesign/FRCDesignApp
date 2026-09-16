import { describe, expect, it } from "vitest";
import { INSERT_LOCATION_NAME } from "./contract";
import { findInsertLocationFeature, getMateConnectorTransform } from "./parse";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeAssemblyFeature
} from "../../lib/onshape/types";

function toAssembly(
    features: OnshapeAssemblyFeature[]
): OnshapeAssemblyDefinition {
    return {
        rootAssembly: { features, instances: [] },
        parts: [],
        subAssemblies: []
    };
}

const INSERT_LOCATION: OnshapeAssemblyFeature = {
    id: "mc",
    featureType: "mateConnector",
    featureData: {
        name: INSERT_LOCATION_NAME,
        mateConnectorCS: {
            origin: [1, 2, 3],
            xAxis: [1, 0, 0],
            zAxis: [0, 0, 1]
        }
    }
};

describe("findInsertLocationFeature", () => {
    it("finds the mate connector named after the insert location", () => {
        const assembly = toAssembly([
            { id: "mate", featureType: "mate" },
            { id: "other", featureType: "mateConnector" },
            INSERT_LOCATION
        ]);
        expect(findInsertLocationFeature(assembly)?.id).toBe("mc");
    });

    it("ignores a suppressed one, which nothing can be inserted at", () => {
        const assembly = toAssembly([{ ...INSERT_LOCATION, suppressed: true }]);
        expect(findInsertLocationFeature(assembly)).toBeUndefined();
    });

    it("finds nothing in an assembly with no insert location", () => {
        expect(
            findInsertLocationFeature(
                toAssembly([{ id: "other", featureType: "mateConnector" }])
            )
        ).toBeUndefined();
    });
});

describe("getMateConnectorTransform", () => {
    it("puts the connector's axes in the columns and its origin last", () => {
        // prettier-ignore
        expect(
            getMateConnectorTransform(toAssembly([INSERT_LOCATION]), "mc")
        ).toEqual([
            1, 0, 0, 1,
            0, 1, 0, 2,
            0, 0, 1, 3,
            0, 0, 0, 1
        ]);
    });

    it("derives the y axis from the two Onshape names", () => {
        const rotated: OnshapeAssemblyFeature = {
            ...INSERT_LOCATION,
            featureData: {
                mateConnectorCS: {
                    origin: [0, 0, 0],
                    xAxis: [0, 1, 0],
                    zAxis: [1, 0, 0]
                }
            }
        };
        // prettier-ignore
        expect(
            getMateConnectorTransform(toAssembly([rotated]), "mc")
        ).toEqual([
            0, 0, 1, 0,
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 0, 1
        ]);
    });

    it("reads the axis spelling Onshape's own schema uses", () => {
        const getters: OnshapeAssemblyFeature = {
            ...INSERT_LOCATION,
            featureData: {
                mateConnectorCS: {
                    origin: [0, 0, 0],
                    getxAxis: [1, 0, 0],
                    getzAxis: [0, 0, 1]
                }
            }
        };
        expect(
            getMateConnectorTransform(toAssembly([getters]), "mc")
        ).toBeDefined();
    });

    it("has no transform for a connector sent without a coordinate system", () => {
        const bare: OnshapeAssemblyFeature = {
            id: "mc",
            featureType: "mateConnector",
            featureData: { name: INSERT_LOCATION_NAME }
        };
        expect(
            getMateConnectorTransform(toAssembly([bare]), "mc")
        ).toBeUndefined();
    });

    it("has no transform for a connector that is no longer there", () => {
        expect(
            getMateConnectorTransform(toAssembly([INSERT_LOCATION]), "gone")
        ).toBeUndefined();
    });
});
