/** `URL.parse`, which Chrome before 126 and Safari before 18 lack; a leaf, so the frontend uses it too. */
export function parseUrl(url: string, base?: string): URL | undefined {
    try {
        return new URL(url, base);
    } catch {
        return undefined;
    }
}
