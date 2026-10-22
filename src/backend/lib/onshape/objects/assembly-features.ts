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

/** An edge or face in the assembly: its deterministic id, in the part occurrence at `path`. */
export interface EntityReference {
    /** The id Onshape's selection reports, which is the entity's deterministic id. */
    deterministicId: string;
    path: string[];
}

/** A circular edge, which a fastener's axis runs through the center of. */
export type EdgeReference = EntityReference;

/** A face, whose circular edges a Replicate can match. */
export type FaceReference = EntityReference;

function entityQueryString(entity: EntityReference): string {
    return `query=qTransient("${entity.deterministicId}");`;
}

/** The entity itself, as a Replicate's matches name it. */
function entityQuery(entity: EntityReference): object {
    return {
        btType: "BTMIndividualQueryWithOccurrence-811",
        entityQuery: entityQueryString(entity),
        deterministicIds: [entity.deterministicId],
        path: entity.path
    };
}

/** The center of a circular edge, where a fastener's axis runs. */
function circularEdgeCenterQuery(edge: EdgeReference): object {
    return {
        btType: "BTMInferenceQueryWithOccurrence-1083",
        inferenceType: "CENTER",
        entityQuery: entityQueryString(edge),
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

/** Fastens `query`'s connector to the center of a circular edge, whose part stays in place. */
export function fastenMateToCircularEdge(
    name: string,
    query: object,
    edge: EdgeReference
): object {
    return fastenMate(
        name,
        [query, featureOccurrenceQuery(PLACEHOLDER_FEATURE_ID)],
        [implicitMateConnector(circularEdgeCenterQuery(edge))]
    );
}

/**
 * What a Replicate copies onto: Onshape's "Match individual edges", or "Match
 * edges on face", which takes every edge of a face matching the seed's and
 * follows the face as it changes. Its "Match edges on plane" isn't used.
 */
export type ReplicateMatch =
    | { edges: EdgeReference[] }
    | { faces: FaceReference[] };

/**
 * Copies fastened instances onto more circular edges, each placed as the
 * mate places the seed, so every edge must be the diameter of the seed's.
 * Onshape publishes no spec for Replicate, so these parameter ids are
 * unverified.
 */
export function replicateFeature(
    name: string,
    instancePaths: string[][],
    mateFeatureId: string,
    match: ReplicateMatch
): object {
    const [scope, entities] =
        "edges" in match
            ? ["INDIVIDUAL_EDGES", match.edges]
            : ["EDGES_ON_FACE", match.faces];
    return {
        btType: "BTMAssemblyReplicateFeature-1351",
        featureType: "replicate",
        name,
        parameters: [
            queryParameter(
                "instances",
                instancePaths.map((path) => ({
                    btType: "BTMIndividualOccurrenceQuery-626",
                    path
                }))
            ),
            queryParameter("mate", [featureOccurrenceQuery(mateFeatureId)]),
            {
                btType: "BTMParameterEnum-145",
                parameterId: "matchScope",
                value: scope,
                enumName: "Match scope"
            },
            queryParameter("matches", entities.map(entityQuery))
        ]
    };
}
