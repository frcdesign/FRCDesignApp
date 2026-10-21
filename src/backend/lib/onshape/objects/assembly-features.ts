/** Utilities and functions for working with assembly features. */

/** A query for a mate connector feature in a part studio. */
export function partStudioMateConnectorQuery(
    featureId: string,
    path: string[] = []
): object {
    return {
        btType: "BTMPartStudioMateConnectorQuery-1324",
        featureId,
        path
    };
}

/** A query for a feature in an assembly. */
export function featureOccurrenceQuery(
    featureId: string,
    path: string[] = [],
    queryData = ""
): object {
    return {
        btType: "BTMFeatureQueryWithOccurrence-157",
        path,
        queryData,
        featureId
    };
}

/** The implicit mate connector at the center of a circular edge, of a part in the assembly. */
export function edgeCenterQuery(path: string[], edgeId: string): object {
    return {
        btType: "BTMInferenceQueryWithOccurrence-1083",
        inferenceType: "CENTER",
        path,
        deterministicIds: [edgeId]
    };
}

function queryParameter(
    parameterId: string,
    queries: Iterable<object>
): object {
    return {
        btType: "BTMParameterQueryWithOccurrenceList-67",
        parameterId,
        queries: [...queries]
    };
}

function mateTypeParameter(value: string): object {
    return {
        btType: "BTMParameterEnum-145",
        parameterId: "mateType",
        value,
        enumName: "Mate type"
    };
}

/**
 * With neither instance constrained, Onshape tends to keep the second in place.
 * `mateConnectors` are implicit ones the mate owns, which its queries name.
 */
export function fastenMate(
    name: string,
    queries: Iterable<object>,
    mateConnectors: object[] = []
): object {
    return {
        btType: "BTMMate-64",
        featureType: "mate",
        name,
        parameters: [
            mateTypeParameter("FASTENED"),
            queryParameter("mateConnectorsQuery", queries)
        ],
        ...(mateConnectors.length > 0 && { mateConnectors })
    };
}

/** A mate names its implicit connector by this, and Onshape assigns the real id. */
const PLACEHOLDER_FEATURE_ID = "0".repeat(17);

/** An edge picked in the Onshape window, in the instance at `path`. */
export interface EdgeReference {
    /** The id Onshape's selection reports, which is the edge's deterministic id. */
    deterministicId: string;
    path: string[];
}

function edgeQueryString(edge: EdgeReference): string {
    return `query=qTransient("${edge.deterministicId}");`;
}

/** The edge itself, as a Replicate's matches name it. */
function edgeQuery(edge: EdgeReference): object {
    return {
        btType: "BTMIndividualQueryWithOccurrence-811",
        entityQuery: edgeQueryString(edge),
        deterministicIds: [edge.deterministicId],
        path: edge.path
    };
}

/** The center of a circular edge, where a fastener's axis runs. */
function circleCenterQuery(edge: EdgeReference): object {
    return {
        btType: "BTMInferenceQueryWithOccurrence-1083",
        inferenceType: "CENTER",
        entityQuery: edgeQueryString(edge),
        deterministicIds: [edge.deterministicId],
        path: edge.path
    };
}

function implicitMateConnector(originQuery: object): object {
    return {
        btType: "BTMMateConnector-66",
        featureType: "mateConnector",
        featureId: PLACEHOLDER_FEATURE_ID,
        name: "Mate connector",
        implicit: true,
        parameters: [
            {
                btType: "BTMParameterEnum-145",
                parameterId: "originType",
                value: "ON_ENTITY",
                enumName: "Origin type"
            },
            queryParameter("originQuery", [originQuery])
        ]
    };
}

/** Fastens `query`'s connector to the center of a circle, which stays in place. */
export function fastenMateToCircle(
    name: string,
    query: object,
    circle: EdgeReference
): object {
    return fastenMate(
        name,
        [query, featureOccurrenceQuery(PLACEHOLDER_FEATURE_ID)],
        [implicitMateConnector(circleCenterQuery(circle))]
    );
}

/**
 * Copies a fastened instance onto more circles, matching each by the seed's
 * mate, so every circle must be the size of the seed's. Onshape publishes no spec for Replicate, so these parameter ids are
 * unverified.
 */
export function replicateFeature(
    name: string,
    instancePath: string[],
    mateFeatureId: string,
    circles: EdgeReference[]
): object {
    return {
        btType: "BTMAssemblyReplicateFeature-1351",
        featureType: "replicate",
        name,
        parameters: [
            queryParameter("instances", [
                {
                    btType: "BTMIndividualOccurrenceQuery-626",
                    path: instancePath
                }
            ]),
            queryParameter("mate", [featureOccurrenceQuery(mateFeatureId)]),
            {
                btType: "BTMParameterEnum-145",
                parameterId: "matchScope",
                value: "INDIVIDUAL_EDGES",
                enumName: "Match scope"
            },
            queryParameter("matches", circles.map(edgeQuery))
        ]
    };
}
