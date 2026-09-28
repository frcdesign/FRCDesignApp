import { useMediaQuery } from "@mantine/hooks";

/**
 * Whether the window is at least this wide, for a control with a roomier form
 * and a narrower one. Read on the first render rather than an effect a frame
 * later, which would show the wrong form and swap it.
 */
export function useHasRoom(minWidth: number): boolean {
    return useMediaQuery(`(min-width: ${minWidth}px)`, false, {
        getInitialValueInEffect: false
    });
}
