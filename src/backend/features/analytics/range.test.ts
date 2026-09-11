import { describe, expect, it } from "vitest";
import { clampRange, eachDay } from "./range";

const TODAY = "2026-09-10";

describe("clampRange", () => {
    it("narrows the start to the first recorded day", () => {
        expect(
            clampRange({ from: "2000-01-01", to: TODAY }, "2026-03-04", TODAY)
        ).toEqual({ from: "2026-03-04", to: TODAY });
    });

    it("leaves a start already inside the recorded days alone", () => {
        expect(
            clampRange({ from: "2026-06-01", to: TODAY }, "2026-03-04", TODAY)
        ).toEqual({ from: "2026-06-01", to: TODAY });
    });

    it("holds the end to today, so no chart densifies days that cannot have happened", () => {
        expect(
            clampRange(
                { from: "2026-01-01", to: "9999-12-31" },
                "2026-03-04",
                TODAY
            )
        ).toEqual({ from: "2026-03-04", to: TODAY });
    });

    it("collapses to the end alone when nothing has been recorded", () => {
        expect(
            clampRange(
                { from: "2000-01-01", to: "9999-12-31" },
                undefined,
                TODAY
            )
        ).toEqual({ from: TODAY, to: TODAY });
    });
});

describe("eachDay", () => {
    it("returns both bounds and everything between them", () => {
        expect(eachDay({ from: "2026-09-08", to: TODAY })).toEqual([
            "2026-09-08",
            "2026-09-09",
            "2026-09-10"
        ]);
    });

    it("returns the single day a collapsed range names", () => {
        expect(eachDay({ from: TODAY, to: TODAY })).toEqual([TODAY]);
    });

    it("returns nothing when the end precedes the start", () => {
        expect(eachDay({ from: TODAY, to: "2026-09-01" })).toEqual([]);
    });

    it("caps a far-future end rather than allocating a point per day to it", () => {
        // Unclamped this is 2.9 million days, which exhausts the Worker before
        // the caller ever gets to build a point for each one.
        const days = eachDay({ from: "2026-01-01", to: "9999-12-31" });
        expect(days.length).toBeLessThanOrEqual(10 * 366);
        expect(days[0]).toBe("2026-01-01");
    });
});
