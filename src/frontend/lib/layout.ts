import { useMediaQuery } from "@mantine/hooks";

/**
 * Whether the window is at least this wide — for a control that has a roomier
 * form and a narrower one, rather than for styling, which CSS should decide.
 *
 * Read on the first render rather than in an effect a frame later: the app is a
 * SPA, so the width is known, and waiting would show the wrong form and swap it.
 */
export function useHasRoom(minWidth: number): boolean {
    return useMediaQuery(`(min-width: ${minWidth}px)`, false, {
        getInitialValueInEffect: false
    });
}
