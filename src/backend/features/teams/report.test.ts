import { describe, expect, it } from "vitest";
import { MIN_RANKED_TEAMS, Medal } from "./contract";
import { rank, teamYear } from "./report";
import { niceEdges, toHistogram } from "../analytics/histogram";

/** `count` teams, valued 1 to `count`. */
function values(count: number): number[] {
    return Array.from({ length: count }, (_, index) => index + 1);
}

describe("rank", () => {
    it("ranks nobody below the floor", () => {
        expect(rank(5, values(MIN_RANKED_TEAMS - 1))).toBeUndefined();
    });

    it("ranks nobody who never used the category", () => {
        expect(rank(0, values(20))).toBeUndefined();
    });

    it("gives the top tenth gold, then silver and bronze", () => {
        const all = values(100);
        expect(rank(100, all)).toMatchObject({
            topPercent: 1,
            medal: Medal.GOLD
        });
        expect(rank(91, all)).toMatchObject({
            topPercent: 10,
            medal: Medal.GOLD
        });
        expect(rank(90, all)).toMatchObject({
            topPercent: 11,
            medal: Medal.SILVER
        });
        expect(rank(76, all)).toMatchObject({
            topPercent: 25,
            medal: Medal.SILVER
        });
        expect(rank(51, all)).toMatchObject({
            topPercent: 50,
            medal: Medal.BRONZE
        });
        expect(rank(50, all)?.topPercent).toBe(51);
        expect(rank(50, all)?.medal).toBeUndefined();
    });

    it("gives tied teams the best rank among them", () => {
        const tied = [...values(9), 10, 10];
        expect(rank(10, tied)?.topPercent).toBe(Math.ceil((1 / 11) * 100));
    });
});

describe("teamYear", () => {
    it("runs September to August", () => {
        expect(teamYear("2026-11-18")).toEqual({
            from: "2026-09-01",
            to: "2027-08-31",
            label: "2026–27"
        });
        expect(teamYear("2027-08-31").label).toBe("2026–27");
        expect(teamYear("2027-09-01").label).toBe("2027–28");
    });
});

describe("distributions", () => {
    it("bins long-tailed values at 1, 2, 5, 10 and on, past the largest", () => {
        expect(niceEdges(0)).toEqual([0, 1]);
        expect(niceEdges(3)).toEqual([0, 1, 2, 5]);
        expect(niceEdges(10)).toEqual([0, 1, 2, 5, 10, 20]);
        const histogram = toHistogram([0, 1, 1, 3, 4, 12], true);
        expect(histogram.bins.map((bin) => bin.count)).toEqual([1, 2, 2, 0, 1]);
    });

    it("marks the bin a ranked team's value falls in", () => {
        const ranking = rank(42, values(100));
        expect(ranking?.distribution.bins[ranking.teamBin]).toMatchObject({
            from: 20,
            to: 50
        });
    });
});
