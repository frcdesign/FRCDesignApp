import { describe, expect, it } from "vitest";
import { meaningfulPartNumber } from "./part-number";

describe("meaningfulPartNumber", () => {
    it.each(["N/A", "n/a", " N/a "])("hides the placeholder %s", (value) => {
        expect(meaningfulPartNumber(value)).toBeUndefined();
    });

    it.each([undefined, null, "", "  "])("hides a blank %s", (value) => {
        expect(meaningfulPartNumber(value)).toBeUndefined();
    });

    it("hides a number that only repeats the name it sits under", () => {
        expect(meaningfulPartNumber(" spacer ", "Spacer")).toBeUndefined();
    });

    it("keeps a real number, trimmed", () => {
        expect(meaningfulPartNumber(" WCP-1025 ", "Gearbox")).toBe("WCP-1025");
    });

    it("keeps one that merely contains the placeholder", () => {
        expect(meaningfulPartNumber("NA-1234")).toBe("NA-1234");
    });
});
