import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDaysAgo, formatTimeAgo } from "./format-time";

const NOW = new Date("2026-09-30T12:00:00Z").getTime();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});

afterEach(() => vi.useRealTimers());

describe("formatTimeAgo", () => {
    it("says just now for under a minute, and for a clock running ahead", () => {
        expect(formatTimeAgo(NOW - 59 * 1000)).toBe("just now");
        expect(formatTimeAgo(NOW + MINUTE)).toBe("just now");
    });

    it("counts whole minutes, then whole hours", () => {
        expect(formatTimeAgo(NOW - MINUTE)).toBe("1 minute ago");
        expect(formatTimeAgo(NOW - 59 * MINUTE)).toBe("59 minutes ago");
        expect(formatTimeAgo(NOW - HOUR)).toBe("1 hour ago");
        expect(formatTimeAgo(NOW - 5 * HOUR - 59 * MINUTE)).toBe("5 hours ago");
    });
});

describe("formatDaysAgo", () => {
    it("counts whole elapsed days", () => {
        expect(formatDaysAgo(NOW - 23 * HOUR)).toBe("Today");
        expect(formatDaysAgo(NOW - 24 * HOUR)).toBe("Yesterday");
        expect(formatDaysAgo(NOW - 72 * HOUR)).toBe("3 days ago");
    });
});
