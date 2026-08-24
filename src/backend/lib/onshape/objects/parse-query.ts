/** Utilities for working with queries in part studios and assemblies. */

// Example (DO NOT DELETE):
// { queryType : UNION , subqueries : [ { disambiguationData : [ { disambiguationType : ORIGINAL_DEPENDENCY , originals : [ { entityType : EDGE , historyType : CREATION , operationId : [ F86ylNPrzWLomm9_1.wireOp ] , queryType : SKETCH_ENTITY , sketchEntityId : rGNlyQ5ipaBS } ] } ] , entityType : EDGE , historyType : CREATION , isStart : false , operationId : [ FHCYmesA2a3t0Lm_1.opExtrude ] , queryType : CAP_EDGE } ] }
// query=makeQuery(makeId(\"FHCYmesA2a3t0Lm_1.opExtrude\"), \"CAP_EDGE\", EntityType.EDGE, { \"isStart\" : false, \"disambiguationData\" : [{ \"disambiguationType\" : \"ORIGINAL_DEPENDENCY\", \"originals\" : [makeQuery(makeId(\"F86ylNPrzWLomm9_1.wireOp\"), \"SKETCH_ENTITY\", EntityType.EDGE, { \"sketchEntityId\" : \"rGNlyQ5ipaBS\" })] } ] });

// query=qTransient("JH1");

/** Parses a query object into a FeatureScript query expression string. */
export function parseQuery(query: Record<string, unknown>): string {
    if (query.queryType === "UNION") {
        const subqueries = (query.subqueries as Record<string, unknown>[])
            .map(parseQuery)
            .join(", ");
        return `qUnion([${subqueries}])`;
    }

    const resultMap = Object.entries(query)
        .map(([key, value]) => `${quote(key)} : ${parseQueryValue(key, value)}`)
        .join(", ");

    if (query.queryType === undefined) return resultMap;
    return `makeQuery({ ${resultMap} })`;
}

function quote(s: string): string {
    return `"${s}"`;
}

function parseId(id: string[]): string {
    return `makeId(${quote(id[0])})`;
}

function parseList(values: unknown[]): string {
    return values
        .map((v) => parseQuery(v as Record<string, unknown>))
        .join(", ");
}

function parseQueryValue(key: string, value: unknown): string {
    if (key === "operationId") return parseId(value as string[]);
    if (key === "entityType") return `EntityType.${String(value)}`;
    if (Array.isArray(value)) return `[${parseList(value)}]`;
    if (value === "true" || value === "false") return value;
    return quote(value as string);
}
