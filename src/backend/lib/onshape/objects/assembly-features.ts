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

function entityQueryString(entity: EntityReference): string {
    return `query=qTransient("${entity.deterministicId}");`;
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
