/** Utilities and functions for working with assembly features. */

/** A dummy ID which allows features to bypass validation. */
export function dummyId(): string {
    return "0".repeat(17);
}

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

/** A query for a specific instance. */
export function individualOccurrenceQuery(path: string[]): object {
    return {
        btType: "BTMIndividualOccurrenceQuery-626",
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

export const ORIGIN_QUERY = featureOccurrenceQuery("Origin", [], "ORIGIN_Z");

/** A builder for fasten mate features. */
export class FastenMateBuilder {
    private readonly mateConnectors: Record<string, unknown>[] = [];
    private readonly queries: object[];

    /**
     * @param queries Initial queries. Note Onshape has a tendency to preserve the location of the
     * second query in cases where neither instance is constrained.
     */
    constructor(
        private readonly name: string,
        queries: Iterable<object> = []
    ) {
        this.queries = [...queries];
    }

    /** Adds a query to the fasten mate. */
    addQuery(query: object): this {
        this.queries.push(query);
        return this;
    }

    /**
     * Adds a user-editable mate connector plus an implicit mate connector sub-feature to the mate.
     */
    addMateConnector(mateConnector: Record<string, unknown>): this {
        const mateId = dummyId();
        mateConnector.featureId = mateId;
        this.mateConnectors.push(mateConnector);
        this.queries.push(featureOccurrenceQuery(mateId));
        return this;
    }

    build(): object {
        return fastenMate(this.name, this.queries, this.mateConnectors);
    }
}

/**
 * Constructs a fasten mate feature.
 *
 * @param queries Up to two queries to fasten. Note Onshape has a tendency to preserve the location
 * of the second query in cases where neither instance is constrained.
 * @param mateConnectors Implicit mate connectors owned by the feature.
 */
export function fastenMate(
    name: string,
    queries: Iterable<object>,
    mateConnectors?: Iterable<object>
): object {
    const connectors = mateConnectors ? [...mateConnectors] : [];
    return {
        btType: "BTMMate-64",
        featureType: "mate",
        name,
        parameters: [
            mateTypeParameter("FASTENED"),
            queryParameter("mateConnectorsQuery", queries)
        ],
        ...(connectors.length > 0 && { mateConnectors: connectors })
    };
}

export function queryParameter(
    parameterId: string,
    queries: Iterable<object>
): object {
    return {
        btType: "BTMParameterQueryWithOccurrenceList-67",
        parameterId,
        queries: [...queries]
    };
}

export function mateTypeParameter(value: string): object {
    return {
        btType: "BTMParameterEnum-145",
        parameterId: "mateType",
        value,
        enumName: "Mate type"
    };
}

export function primaryAxisParameter(
    parameterId: string,
    value = false
): object {
    return {
        btType: "BTMParameterBoolean-144",
        parameterId,
        value
    };
}

/** Constructs a group mate feature. */
export function groupMate(name: string, queries: Iterable<object>): object {
    return {
        btType: "BTMMateGroup-65",
        name,
        featureType: "mateGroup",
        parameters: [queryParameter("occurrencesQuery", queries)]
    };
}

/** Constructs a mate connector feature. */
export function mateConnector(
    name: string,
    originQuery: object,
    implicit = false
): object {
    return {
        btType: "BTMMateConnector-66",
        name,
        implicit,
        parameters: [
            {
                btType: "BTMParameterEnum-145",
                value: "ON_ENTITY",
                enumName: "Origin type",
                parameterId: "originType"
            },
            queryParameter("originQuery", [originQuery])
        ]
    };
}

/** Constructs a mate connector that is implicitly owned by another mate. */
export function implicitMateConnector(originQuery: object): object {
    return mateConnector("Mate connector", originQuery, true);
}
