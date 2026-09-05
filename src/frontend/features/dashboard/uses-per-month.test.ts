import { describe, expect, it } from "vitest";
import { usesPerMonth } from "@backend/features/analytics/measures";

const DAY = 24 * 3600 * 1000;
const NOW = Date.UTC(2026, 5, 1);
const ago = (days: number) => NOW - days * DAY;

describe("usesPerMonth", () => {
    it("is zero for a part nobody has inserted", () => {
        expect(usesPerMonth(0, null, NOW)).toBe(0);
    });

    it("scales a long history down to one month", () => {
        // 120 inserts over a year is ten a month.
        expect(usesPerMonth(120, ago(360), NOW)).toBe(10);
    });

    it("does not extrapolate a part younger than a month", () => {
        // Two uses in its first week is two a month, not sixty.
        expect(usesPerMonth(2, ago(1), NOW)).toBe(2);
    });

    it("ranks a recent part above an older one with a bigger total", () => {
        const recent = usesPerMonth(20, ago(60), NOW);
        const old = usesPerMonth(30, ago(720), NOW);
        expect(recent).toBeGreaterThan(old);
    });

    it("rounds rather than truncating, so a used part never reads as zero", () => {
        expect(usesPerMonth(1, ago(45), NOW)).toBe(1);
    });

    it("reads as zero only when the rate rounds below a half", () => {
        // Once a year really is closer to zero a month than to one.
        expect(usesPerMonth(1, ago(365), NOW)).toBe(0);
    });
});
