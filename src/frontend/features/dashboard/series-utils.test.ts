import { describe, expect, it } from "vitest";
import type { DailyInsertPoint } from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import { toChartData } from "./series-utils";

const FRC = getLibraryName(LibraryId.FRC_DESIGN_LIB);
const MKCAD = getLibraryName(LibraryId.MKCAD);

/** Builds `count` consecutive days starting at 2026-01-01. */
function makeDays(count: number): DailyInsertPoint[] {
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(Date.UTC(2026, 0, 1 + index));
        return {
            day: date.toISOString().slice(0, 10),
            counts: { [LibraryId.FRC_DESIGN_LIB]: 1 }
        };
    });
}

describe("toChartData", () => {
    it("gives every series a value on every point", () => {
        const data = toChartData(
            [
                {
                    day: "2026-01-01",
                    counts: { [LibraryId.FRC_DESIGN_LIB]: 4 }
                },
                { day: "2026-01-02", counts: { [LibraryId.MKCAD]: 2 } }
            ],
            [LibraryId.FRC_DESIGN_LIB, LibraryId.MKCAD]
        );

        // A missing library must read 0, not undefined, or the line breaks up.
        expect(data[0][FRC]).toBe(4);
        expect(data[0][MKCAD]).toBe(0);
        expect(data[1][FRC]).toBe(0);
        expect(data[1][MKCAD]).toBe(2);
    });

    it("keeps short ranges at daily resolution", () => {
        const data = toChartData(makeDays(30), [LibraryId.FRC_DESIGN_LIB]);
        expect(data).toHaveLength(30);
    });

    it("buckets a long range by month", () => {
        // 365 daily points would be unreadable, so they collapse to months.
        const data = toChartData(makeDays(365), [LibraryId.FRC_DESIGN_LIB]);

        // 365 days from Jan 1 of a non-leap year is exactly 12 months.
        expect(data).toHaveLength(12);
        expect(data[0][FRC]).toBe(31); // all of January
        expect(data[0].date).toBe("Jan 2026");
    });

    it("returns nothing for an empty series", () => {
        expect(toChartData([], [LibraryId.FRC_DESIGN_LIB])).toEqual([]);
    });
});
