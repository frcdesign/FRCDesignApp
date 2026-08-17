import { describe, expect, it } from "vitest";
import { findRecordForConfiguration } from "./configuration-utils";
import { SearchRecord } from "./configuration-models";

function rec(
    configuration: Record<string, string>,
    partNumber = "PN"
): SearchRecord {
    return { partNumber, name: null, configuration };
}

describe("findRecordForConfiguration", () => {
    it("returns the record whose enumerated values match the selection", () => {
        const records = [
            rec({ size: "s" }, "PN-S"),
            rec({ size: "l" }, "PN-L")
        ];
        // The selection also carries a non-enumerated (quantity) param, ignored.
        expect(
            findRecordForConfiguration({ size: "l", qty: "3" }, records)
                ?.partNumber
        ).toBe("PN-L");
    });

    it("prefers the most specific match when several apply", () => {
        const records = [rec({}, "default"), rec({ size: "l" }, "PN-L")];
        expect(
            findRecordForConfiguration({ size: "l" }, records)?.partNumber
        ).toBe("PN-L");
    });

    it("falls back to a shorter key-set when a parameter is hidden", () => {
        const records = [
            rec({ mode: "a", detail: "x" }, "A-X"),
            // `detail` is hidden when mode=b, so this record omits it.
            rec({ mode: "b" }, "B")
        ];
        expect(
            findRecordForConfiguration({ mode: "b", detail: "x" }, records)
                ?.partNumber
        ).toBe("B");
    });

    it("returns undefined when nothing matches", () => {
        const records = [rec({ size: "s" }, "PN-S")];
        expect(
            findRecordForConfiguration({ size: "l" }, records)
        ).toBeUndefined();
    });
});
