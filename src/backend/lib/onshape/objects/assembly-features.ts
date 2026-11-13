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

/** What a mate's queries call the implicit connector it owns; Onshape gives it its own id. */
const IMPLICIT_CONNECTOR_ID = "0".repeat(17);

/**
 * Fastens `query`'s connector to the assembly origin, as a fasten made by hand
 * does: to an implicit connector the mate owns, on the origin's Z axis.
 */
export function fastenMateToOrigin(name: string, query: object): object {
    return {
        ...fastenMate(name, [
            query,
            featureOccurrenceQuery(IMPLICIT_CONNECTOR_ID)
        ]),
        mateConnectors: [
            {
                btType: "BTMMateConnector-66",
                featureType: "mateConnector",
                featureId: IMPLICIT_CONNECTOR_ID,
                name: "Mate connector",
                implicit: true,
                parameters: [
                    {
                        btType: "BTMParameterEnum-145",
                        parameterId: "originType",
                        value: "ON_ENTITY",
                        enumName: "Origin type"
                    },
                    queryParameter("originQuery", [
                        featureOccurrenceQuery("Origin", [], "ORIGIN_Z")
                    ])
                ]
            }
        ]
    };
}
