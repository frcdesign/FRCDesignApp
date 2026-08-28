import { describe, expect, it } from "vitest";
import type { PeriodComparison } from "@backend/features/analytics/contract";
import { perUnit } from "./derived";

function comparison(
    current: number,
    previous: number,
    unavailable?: PeriodComparison["unavailable"]
): PeriodComparison {
    return {
        current,
        previous,
        changeRatio: unavailable ? null : 0,
        unavailable,
        currentFrom: "2026-08-01",
        currentTo: "2026-08-28",
        previousFrom: "2026-07-04",
        previousTo: "2026-07-31",
        label: "Last 28 days",
        baselineLabel: "the 28 days before",
        baselineShort: "28 days"
    };
}

describe("perUnit", () => {
    it("divides both windows before comparing them", () => {
        const rate = perUnit(comparison(120, 50), comparison(20, 25));
        expect(rate.current).toBe(6);
        expect(rate.previous).toBe(2);
        expect(rate.changeRatio).toBeCloseTo(2);
    });

    it("catches a rate falling while the count rises", () => {
        // Twice the uses, but four times the people: usage per person halved.
        const rate = perUnit(comparison(200, 100), comparison(40, 10));
        expect(rate.changeRatio).toBeCloseTo(-0.5);
    });

    it("carries a term's reason rather than inventing a number", () => {
        const rate = perUnit(
            comparison(120, 0, "no-prior-data"),
            comparison(20, 0)
        );
        expect(rate.changeRatio).toBeNull();
        expect(rate.unavailable).toBe("no-prior-data");
    });

    it("reads an empty denominator as no rate, not as a division by zero", () => {
        const rate = perUnit(comparison(10, 0), comparison(0, 0));
        expect(Number.isFinite(rate.current)).toBe(true);
        expect(rate.current).toBe(0);
        expect(rate.unavailable).toBe("no-activity");
    });
});
