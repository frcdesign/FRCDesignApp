import { describe, expect, it } from "vitest";
import { mergePositions } from "./highlight";

describe("mergePositions", () => {
    it("returns runs in ascending order, whatever order they arrived in", () => {
        expect(
            mergePositions([
                { start: 8, length: 2 },
                { start: 0, length: 3 }
            ])
        ).toEqual([
            { start: 0, length: 3 },
            { start: 8, length: 2 }
        ]);
    });

    it("joins two runs that overlap into the one covering both", () => {
        expect(
            mergePositions([
                { start: 0, length: 4 },
                { start: 2, length: 5 }
            ])
        ).toEqual([{ start: 0, length: 7 }]);
    });

    it("joins two runs that touch, leaving no empty slice between them", () => {
        expect(
            mergePositions([
                { start: 0, length: 2 },
                { start: 2, length: 2 }
            ])
        ).toEqual([{ start: 0, length: 4 }]);
    });

    it("keeps a gap between runs that do not touch", () => {
        expect(
            mergePositions([
                { start: 0, length: 2 },
                { start: 3, length: 1 }
            ])
        ).toEqual([
            { start: 0, length: 2 },
            { start: 3, length: 1 }
        ]);
    });

    it("has nothing to merge when nothing matched", () => {
        expect(mergePositions([])).toEqual([]);
    });
});
