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

/**
 * A query for an entity/selection in a part studio.
 */
export function inferenceQuery(
    selectionId: string,
    path: string[] = []
): object {
    return {
        btType: "BTMInferenceQueryWithOccurrence-1083",
        inferenceType: "CENTER",
        entityQuery: "",
        // entityQuery: `query=qTransient("${selectionId}");`,
        path,
        deterministicIds: [selectionId]
    };
}

/** A builder for fasten mate features. */
export class FastenMateBuilder {
    /**
     * @param queries Initial queries. Note Onshape has a tendency to preserve the location of the
     * second query in cases where neither instance is constrained.
     */
    constructor(
        private readonly name: string,
        private readonly queries: object[] = [],
        private readonly mateConnectors: Record<string, unknown>[] = []
    ) {}

    addQuery(query: object): this {
        this.queries.push(query);
        return this;
    }

    /**
     * Adds a user-editable mate connector plus an implicit mate connector sub-feature to the mate.
     */
    addMateConnector(mateConnector: Record<string, unknown>): this {
        const mateId = dummyId();
        this.queries.push(featureOccurrenceQuery(mateId));
        mateConnector.featureId = mateId;
        this.mateConnectors.push(mateConnector);
        return this;
    }

    build(): object {
        return fastenMate(this.name, this.queries, this.mateConnectors);
    }
}

/**
 * Takes up to two queries. With neither instance constrained, Onshape tends to
 * preserve the second one's location.
 */
export function fastenMate(
    name: string,
    queries: object[],
    mateConnectors: object[] = []
): object {
    const result: Record<string, unknown> = {
        btType: "BTMMate-64",
        featureType: "mate",
        name,
        mateConnectors,
        parameters: [
            mateTypeParameter("FASTENED"),
            queryParameter("mateConnectorsQuery", queries)
        ]
    };
    return result;
}

export function queryParameter(parameterId: string, queries: object[]): object {
    return {
        btType: "BTMParameterQueryWithOccurrenceList-67",
        parameterId,
        queries
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

export function groupMate(name: string, queries: object[]): object {
    return {
        btType: "BTMMateGroup-65",
        name,
        featureType: "mateGroup",
        parameters: [queryParameter("occurrencesQuery", queries)]
    };
}

/**
 * Constructs a mate connector feature.
 */
export function makeMateConnector(
    name: string,
    originQuery: object,
    implicit = false
): Record<string, unknown> {
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
export function implicitMateConnector(
    originQuery: object
): Record<string, unknown> {
    return makeMateConnector("Mate connector", originQuery, true);
}
