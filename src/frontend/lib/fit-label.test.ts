import { describe, expect, it } from "vitest";
import { fitLabel } from "./fit-label";

/** Every character, the ellipsis included, is 10 wide. */
const measure = (text: string): number => text.length * 10;

describe("fitLabel", () => {
    it("keeps a label that fits", () => {
        expect(fitLabel("Part 1", 60, measure)).toBe("Part 1");
    });

    it("cuts a long label to the longest start that fits, with an ellipsis", () => {
        expect(fitLabel("#10-32 x 1/2 in Button", 100, measure)).toBe(
            "#10-32 x…"
        );
    });

    it("drops the space before the ellipsis", () => {
        expect(fitLabel("Shaft collar", 70, measure)).toBe("Shaft…");
    });

    it("hides a label when fewer than three letters would show", () => {
        expect(fitLabel("#10-32 x 1/2 in Button", 30, measure)).toBeUndefined();
        expect(fitLabel("Bearing", 0, measure)).toBeUndefined();
    });
});
