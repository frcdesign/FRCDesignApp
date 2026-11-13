const MAX_CAUSES = 5;

/**
 * An error's name and message, then each cause's. Workers Logs keeps an
 * Error argument's stack frames and drops its message line, so log this too.
 */
export function describeError(error: unknown): string {
    const parts: string[] = [];
    let current = error;
    while (current !== undefined && parts.length < MAX_CAUSES) {
        if (!(current instanceof Error)) {
            parts.push(String(current));
            break;
        }
        parts.push(`${current.name}: ${current.message}`);
        current = current.cause;
    }
    return parts.join(" <- ");
}
