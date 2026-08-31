import { describe, expect, it } from "vitest";
import { clean, equalsIgnoreCase } from "./text";

describe("clean", () => {
    it("trims the value", () => {
        expect(clean("  WCP-1025 ")).toBe("WCP-1025");
    });

    it.each([undefined, null, "", "   "])(
        "reads %s as nothing at all",
        (value) => {
            expect(clean(value)).toBeUndefined();
        }
    );
});

describe("equalsIgnoreCase", () => {
    it("ignores case and surrounding space", () => {
        expect(equalsIgnoreCase(" Spacer ", "spacer")).toBe(true);
    });

    it("separates different text", () => {
        expect(equalsIgnoreCase("Spacer", "Standoff")).toBe(false);
    });

    // Two parts with nothing to say are not thereby the same part.
    it("does not equate two blanks with a value", () => {
        expect(equalsIgnoreCase("  ", undefined)).toBe(true);
        expect(equalsIgnoreCase("Spacer", undefined)).toBe(false);
    });
});
