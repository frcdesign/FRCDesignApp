import { afterEach, describe, expect, it, vi } from "vitest";
import { reloadOnStaleBuild } from "./stale-build";

/** What Vite dispatches when a lazy import fails; whether it was prevented. */
function failImport(): boolean {
    const event = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
}

describe("reloadOnStaleBuild", () => {
    let stop: (() => void) | undefined;

    afterEach(() => {
        stop?.();
        vi.useRealTimers();
    });

    it("reloads a tab whose build is gone, once, then lets a repeat crash", () => {
        vi.useFakeTimers({ now: 1_000_000 });
        const reload = vi.fn();
        stop = reloadOnStaleBuild(reload);

        expect(failImport()).toBe(true);
        expect(failImport()).toBe(false);
        expect(reload).toHaveBeenCalledTimes(1);

        vi.setSystemTime(1_000_000 + 60_000);
        expect(failImport()).toBe(true);
        expect(reload).toHaveBeenCalledTimes(2);
    });
});
