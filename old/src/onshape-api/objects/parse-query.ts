/** Utilities for working with queries in part studios and assemblies. */

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
    return values.map((v) => parseQuery(v as Record<string, unknown>)).join(", ");
}

function parseQueryValue(key: string, value: unknown): string {
    if (key === "operationId") return parseId(value as string[]);
    if (key === "entityType") return `EntityType.${value}`;
    if (Array.isArray(value)) return `[${parseList(value)}]`;
    if (value === "true" || value === "false") return value as string;
    return quote(value as string);
}
