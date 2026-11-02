import type { OnshapeFeatureListResponse } from "@backend/lib/onshape/types";

type Feature = OnshapeFeatureListResponse["features"][number];

/** A mate connector in a part studio's feature list, live unless told otherwise. */
export function mateConnectorFeature(
    featureId: string,
    overrides: Partial<Feature> = {}
): Feature {
    return {
        featureType: "mateConnector",
        featureId,
        name: featureId,
        suppressed: false,
        ...overrides
    };
}

/** A part studio's features response, as `getFeatures` returns it. */
export function featureList(
    features: Feature[] = [],
    featureStates?: OnshapeFeatureListResponse["featureStates"]
): OnshapeFeatureListResponse {
    return { features, featureStates };
}
