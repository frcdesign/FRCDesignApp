/** Fewer letters than this before the ellipsis say nothing, so the label is hidden. */
const MIN_LABEL_CHARS = 3;
const ELLIPSIS = "…";

/**
 * `text` if it fits in `width`, else its longest start that fits with an
 * ellipsis; undefined when not even a few letters do.
 */
export function fitLabel(
    text: string,
    width: number,
    measure: (text: string) => number
): string | undefined {
    if (measure(text) <= width) {
        return text;
    }
    const cut = (length: number): string =>
        text.slice(0, length).trimEnd() + ELLIPSIS;
    let low = 0;
    let high = text.length - 1;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (measure(cut(mid)) <= width) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return low >= MIN_LABEL_CHARS ? cut(low) : undefined;
}
