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

/** With neither instance constrained, Onshape tends to keep the second in place. */
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

/**
 * Moves the occurrences as one body. Onshape documents no example of this
 * feature; its shape follows the group feature's spec.
 */
export function groupMate(name: string, paths: Iterable<string[]>): object {
    return {
        btType: "BTMMateGroup-65",
        featureType: "mateGroup",
        name,
        parameters: [
            queryParameter(
                "occurrencesQuery",
                [...paths].map((path) => ({
                    btType: "BTMIndividualOccurrenceQuery-626",
                    path
                }))
            )
        ]
    };
}
