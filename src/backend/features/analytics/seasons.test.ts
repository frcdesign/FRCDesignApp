import { describe, expect, it } from "vitest";
import {
    baselineWindow,
    championshipOf,
    currentSeason,
    lastCompleteSeason,
    LIBRARY_PROGRAM,
    Program,
    seasonOf,
    seasonWindow,
    seasonsBetween
} from "./seasons";
import { LibraryId } from "../library/library-id";

describe("seasonOf", () => {
    it("names an FRC season by its calendar year", () => {
        expect(seasonOf(Program.FRC, 2027)).toMatchObject({
            from: "2027-01-01",
            to: "2027-04-30",
            label: "FRC 2027"
        });
    });

    it("names an FTC season by the two years it spans", () => {
        expect(seasonOf(Program.FTC, 2027)).toMatchObject({
            from: "2026-09-01",
            to: "2027-04-30",
            label: "FTC 2026–27"
        });
    });
});

describe("currentSeason", () => {
    it.each([
        ["2026-12-31", null],
        ["2027-01-01", "FRC 2027"],
        ["2027-04-30", "FRC 2027"],
        ["2027-05-01", null]
    ])("places %s in the FRC season %s", (day, label) => {
        expect(currentSeason(Program.FRC, day)?.label ?? null).toBe(label);
    });

    it.each([
        ["2026-08-31", null],
        ["2026-09-01", "FTC 2026–27"],
        // The one that a naive year lookup gets wrong: January belongs to a
        // season that opened the previous September.
        ["2027-01-15", "FTC 2026–27"],
        ["2027-04-30", "FTC 2026–27"],
        ["2027-05-01", null]
    ])("places %s in the FTC season %s", (day, label) => {
        expect(currentSeason(Program.FTC, day)?.label ?? null).toBe(label);
    });
});

describe("seasonWindow", () => {
    it("clips an in-progress season to today", () => {
        const window = seasonWindow(Program.FRC, "2027-02-01");
        expect(window).toMatchObject({
            from: "2027-01-01",
            to: "2027-02-01",
            inProgress: true,
            elapsedDays: 32
        });
    });

    it("falls back to the last complete season between seasons", () => {
        // Late August: FRC finished in April and the next has not opened.
        const window = seasonWindow(Program.FRC, "2026-08-27");
        expect(window).toMatchObject({
            from: "2026-01-01",
            to: "2026-04-30",
            inProgress: false
        });
        expect(window.season.label).toBe("FRC 2026");
    });
});

describe("baselineWindow", () => {
    it("clips the baseline to the same elapsed stretch", () => {
        // 32 days into 2027 compares against the first 32 days of 2026, not
        // against the whole of it.
        const baseline = baselineWindow(
            seasonWindow(Program.FRC, "2027-02-01")
        );
        expect(baseline).toMatchObject({
            from: "2026-01-01",
            to: "2026-02-01"
        });
        expect(baseline.season.label).toBe("FRC 2026");
    });

    it("compares whole seasons once one has finished", () => {
        const baseline = baselineWindow(
            seasonWindow(Program.FRC, "2026-08-27")
        );
        expect(baseline).toMatchObject({
            from: "2025-01-01",
            to: "2025-04-30"
        });
    });

    it("keeps an FTC baseline on the same side of New Year", () => {
        // 40 days into a season that opened in September lands in October.
        const baseline = baselineWindow(
            seasonWindow(Program.FTC, "2026-10-10")
        );
        expect(baseline).toMatchObject({
            from: "2025-09-01",
            to: "2025-10-10"
        });
    });
});

describe("lastCompleteSeason", () => {
    it("does not return a season that is still running", () => {
        expect(lastCompleteSeason(Program.FRC, "2027-03-01").label).toBe(
            "FRC 2026"
        );
    });
});

describe("seasonsBetween", () => {
    it("returns every season overlapping the range, for chart bands", () => {
        const seasons = seasonsBetween(Program.FRC, "2025-06-01", "2027-06-01");
        expect(seasons.map((season) => season.label)).toEqual([
            "FRC 2026",
            "FRC 2027"
        ]);
    });

    it("includes a season the range only clips the tail of", () => {
        const seasons = seasonsBetween(Program.FTC, "2027-04-15", "2027-05-01");
        expect(seasons.map((season) => season.label)).toEqual(["FTC 2026–27"]);
    });

    it("returns nothing for a range entirely between seasons", () => {
        expect(seasonsBetween(Program.FRC, "2026-06-01", "2026-08-01")).toEqual(
            []
        );
    });
});

describe("LIBRARY_PROGRAM", () => {
    it("maps every library, so a band never silently goes missing", () => {
        for (const libraryId of Object.values(LibraryId)) {
            expect(LIBRARY_PROGRAM[libraryId]).toBeDefined();
        }
        expect(LIBRARY_PROGRAM[LibraryId.MKCAD]).toBe(Program.FRC);
        expect(LIBRARY_PROGRAM[LibraryId.FTC_DESIGN_LIB]).toBe(Program.FTC);
    });
});

describe("years", () => {
    it("names a season without naming a program", () => {
        expect(seasonOf(Program.FRC, 2027).years).toBe("2027");
        expect(seasonOf(Program.FTC, 2027).years).toBe("2026–27");
    });
});

describe("championshipOf", () => {
    it("puts both programs' seasons on the same closing event", () => {
        // One event finishes both, so a chart must not draw two markers.
        expect(championshipOf(seasonOf(Program.FRC, 2027))).toBe(
            championshipOf(seasonOf(Program.FTC, 2027))
        );
    });

    it("falls inside the season it closes", () => {
        const season = seasonOf(Program.FTC, 2027);
        const day = championshipOf(season);
        expect(day >= season.from && day <= season.to).toBe(true);
    });
});
