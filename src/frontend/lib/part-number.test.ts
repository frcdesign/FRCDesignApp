import { describe, expect, it } from "vitest";
import { displayPartNumber } from "./part-number";

describe("displayPartNumber", () => {
    it.each(["N/A", "n/a", " N/a "])("hides the placeholder %s", (value) => {
        expect(displayPartNumber(value)).toBeUndefined();
    });

    it("hides a number that only repeats the name it sits under", () => {
        expect(displayPartNumber(" spacer ", "Spacer")).toBeUndefined();
    });

    it("keeps a real number, trimmed", () => {
        expect(displayPartNumber(" WCP-1025 ", "Gearbox")).toBe("WCP-1025");
    });

    it("keeps one that merely contains the placeholder", () => {
        expect(displayPartNumber("NA-1234")).toBe("NA-1234");
    });
});
