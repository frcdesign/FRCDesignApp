import { describe, expect, it } from "vitest";
import { toSearchRecords } from "./search-index";
import { Vendor } from "../library/vendors";
import { configurationRecord as record } from "../../../__test_utils__/configuration-fixtures";

describe("toSearchRecords", () => {
    it("drops a part number that only repeats the name", () => {
        const [result] = toSearchRecords([
            record({ partNumber: "Spacer", name: "Spacer" })
        ]);
        expect(result.partNumber).toBeUndefined();
        expect(result.name).toBe("Spacer");
    });

    it("ignores case and surrounding space when comparing the two", () => {
        const [result] = toSearchRecords([
            record({ partNumber: " spacer ", name: "Spacer" })
        ]);
        expect(result.partNumber).toBeUndefined();
    });

    it("will not link a repeated part number to a vendor", () => {
        const [result] = toSearchRecords(
            [record({ partNumber: "Bearing", name: "Bearing" })],
            [Vendor.WCP]
        );
        expect(result.url).toBeUndefined();
    });

    it("keeps a part number that says something the name does not", () => {
        const [result] = toSearchRecords(
            [record({ partNumber: "WCP-1025", name: "Gearbox" })],
            [Vendor.WCP]
        );
        expect(result.partNumber).toBe("WCP-1025");
        expect(result.url).toBe("https://wcproducts.com/products/wcp-1025");
    });

    it("keeps a record that is left with only a name", () => {
        expect(
            toSearchRecords([record({ partNumber: "Spacer", name: "Spacer" })])
        ).toHaveLength(1);
    });

    it("drops a record with neither", () => {
        expect(toSearchRecords([record({})])).toHaveLength(0);
    });
});
