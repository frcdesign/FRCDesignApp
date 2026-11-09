/** Names Onshape might put a limit, a count left or a reset time under. */
export function isLimitHeader(name: string): boolean {
    return /rate|limit|retry|quota|remaining|reset|throttl/i.test(name);
}

/** The headers that look like a limit's, as `name: value` lines, sorted by name. */
export function limitHeaderLines(headers: Record<string, string>): string[] {
    return Object.entries(headers)
        .filter(([name]) => isLimitHeader(name))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => `${name}: ${value}`);
}
