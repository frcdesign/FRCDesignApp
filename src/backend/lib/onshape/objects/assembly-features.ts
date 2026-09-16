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
 * A mate connector on the assembly's own origin, for the caller to move where
 * they want it. Onshape documents creating one on an entity; leaving the origin
 * query empty is, as far as we can tell, how the dialog says "nothing selected".
 */
export function originMateConnector(name: string): object {
    return {
        btType: "BTMMateConnector-66",
        featureType: "mateConnector",
        name,
        parameters: [
            {
                btType: "BTMParameterEnum-145",
                parameterId: "originType",
                value: "ON_ENTITY",
                enumName: "Origin type"
            },
            queryParameter("originQuery", [])
        ],
        isHidden: false,
        suppressed: false
    };
}

/**
 * Takes up to two queries. With neither instance constrained, Onshape tends to
 * preserve the second one's location.
 */
export function fastenMate(name: string, queries: Iterable<object>): object {
    return {
        btType: "BTMMate-64",
        featureType: "mate",
        name,
        parameters: [
            mateTypeParameter("FASTENED"),
            queryParameter("mateConnectorsQuery", queries)
        ]
    };
}
