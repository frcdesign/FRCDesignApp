import { describe, expect, it } from "vitest";
import { addDays, toDayKey } from "./day";

describe("toDayKey", () => {
    // The whole point of reporting in a fixed US zone: an evening build session
    // is one day's work, and UTC would split it across two.
    it("keeps a US evening on the day it was worked", () => {
        // 10pm Eastern on 10 Sep, which UTC already calls the 11th.
        expect(toDayKey(Date.parse("2026-09-11T02:00:00Z"))).toBe("2026-09-10");
    });

    it("does the same in winter, when the offset is an hour wider", () => {
        // 9pm Eastern on 14 Jan; UTC calls it the 15th.
        expect(toDayKey(Date.parse("2026-01-15T02:00:00Z"))).toBe("2026-01-14");
    });

    it("rolls over at local midnight, not UTC midnight", () => {
        expect(toDayKey(Date.parse("2026-09-11T03:59:00Z"))).toBe("2026-09-10");
        expect(toDayKey(Date.parse("2026-09-11T04:01:00Z"))).toBe("2026-09-11");
    });
});

describe("addDays", () => {
    it("steps forward and back", () => {
        expect(addDays("2026-09-10", 1)).toBe("2026-09-11");
        expect(addDays("2026-09-10", -1)).toBe("2026-09-09");
        expect(addDays("2026-09-10", 0)).toBe("2026-09-10");
    });

    it("crosses a month and a year", () => {
        expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
        expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    });

    // A day key is a calendar date, so the spring-forward day is still one day
    // wide even though the zone's day is 23 hours long.
    it("steps one day across a DST transition", () => {
        expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
        expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
        expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    });
});
