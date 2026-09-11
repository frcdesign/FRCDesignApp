import { ReactNode } from "react";
import { mergePositions, type Position } from "../lib/highlight";

interface HighlightedTextProps {
    text: string;
    /** Where the query matched; nothing highlights when absent. */
    positions?: Position[];
}

/** Underlines wherever the query matched inside `text`. */
export function HighlightedText(props: HighlightedTextProps): ReactNode {
    const { text, positions = [] } = props;
    return <>{applyPositions(text, positions)}</>;
}

function applyPositions(text: string, positions: Position[]): ReactNode[] {
    const result: ReactNode[] = [];
    let currentIndex = 0;

    for (const { start, length } of mergePositions(positions).sort(
        (a, b) => a.start - b.start
    )) {
        const end = start + length;
        if (currentIndex < start) {
            result.push(text.slice(currentIndex, start));
        }
        result.push(<u key={currentIndex}>{text.slice(start, end)}</u>);
        currentIndex = end;
    }

    if (currentIndex < text.length) {
        result.push(text.slice(currentIndex));
    }
    return result;
}
