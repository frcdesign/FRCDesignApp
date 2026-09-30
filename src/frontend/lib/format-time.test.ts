import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { formatTimeAgo } from "./format-time";

const NOW = new Date("2026-09-30T12:00:00Z").getTime();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});

afterEach(() => vi.useRealTimers());

it("says just now for under a minute, and for a clock running ahead", () => {
    expect(formatTimeAgo(NOW - 59 * 1000)).toBe("just now");
    expect(formatTimeAgo(NOW + MINUTE)).toBe("just now");
});

it("counts the largest whole unit that has passed", () => {
    expect(formatTimeAgo(NOW - MINUTE)).toBe("1 minute ago");
    expect(formatTimeAgo(NOW - 59 * MINUTE)).toBe("59 minutes ago");
    expect(formatTimeAgo(NOW - 5 * HOUR - 59 * MINUTE)).toBe("5 hours ago");
    expect(formatTimeAgo(NOW - DAY)).toBe("yesterday");
    expect(formatTimeAgo(NOW - 6 * DAY)).toBe("6 days ago");
});

it("gives a date once it is a week old", () => {
    expect(formatTimeAgo(NOW - 7 * DAY)).toBe("Sep 23, 2026");
});
