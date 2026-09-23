import { describe, expect, it } from "vitest";
import { buildSearchDb } from "./build";
import { distinctRecords, toSearchRecords } from "./records";
import { LibraryOut } from "../library/contract";
import { ElementType } from "../../lib/onshape/element-type";
import { Vendor } from "../library/vendors";
import {
    enumParam,
    configurationRecord as record
} from "../../../__test_utils__/configuration-fixtures";
import { type ConfigurationRecord } from "../configurations/contract";

/** Records of an element with nothing to configure. */
const unconfigured = (records: ConfigurationRecord[], vendors?: Vendor[]) =>
    toSearchRecords(records, [], vendors);

describe("toSearchRecords", () => {
    it("drops a part number that only repeats the name", () => {
        const [result] = unconfigured([
            record({ partNumber: "Spacer", name: "Spacer" })
        ]);
        expect(result.partNumber).toBeUndefined();
        expect(result.name).toBe("Spacer");
    });

    it("ignores case and surrounding space when comparing the two", () => {
        const [result] = unconfigured([
            record({ partNumber: " spacer ", name: "Spacer" })
        ]);
        expect(result.partNumber).toBeUndefined();
    });

    it("will not link a repeated part number to a vendor", () => {
        const [result] = unconfigured(
            [record({ partNumber: "Bearing", name: "Bearing" })],
            [Vendor.WCP]
        );
        expect(result.url).toBeUndefined();
    });

    it("keeps a part number that says something the name does not", () => {
        const [result] = unconfigured(
            [record({ partNumber: "WCP-1025", name: "Gearbox" })],
            [Vendor.WCP]
        );
        expect(result.partNumber).toBe("WCP-1025");
        expect(result.url).toBe("https://wcproducts.com/products/wcp-1025");
    });

    it("keeps a record that is left with only a name", () => {
        expect(
            unconfigured([record({ partNumber: "Spacer", name: "Spacer" })])
        ).toHaveLength(1);
    });

    it("drops a record with neither", () => {
        expect(unconfigured([record({})])).toHaveLength(0);
    });

    // The placeholder an admin writes in identifies nothing, so it is dropped
    // here rather than indexed and shown.
    it("drops a placeholder part number", () => {
        const [result] = unconfigured([
            record({ partNumber: "N/A", name: "Spacer" })
        ]);
        expect(result).toMatchObject({ partNumber: undefined, name: "Spacer" });
    });

    it("will not link a placeholder to a vendor", () => {
        const [result] = unconfigured(
            [record({ partNumber: "N/A", name: "Spacer" })],
            [Vendor.WCP]
        );
        expect(result.url).toBeUndefined();
    });

    it("drops a record the placeholder leaves with nothing", () => {
        expect(unconfigured([record({ partNumber: "N/A" })])).toEqual([]);
    });

    // Only thumbnails read the key; the values are what open the menu.
    it("carries a record's values, and their key for its thumbnail", () => {
        const size = enumParam("size", ["s", "l"]);
        const [result] = toSearchRecords(
            [record({ name: "Gear", values: { size: "l" } })],
            [size]
        );
        expect(result).toMatchObject({
            values: { size: "l" },
            configurationKey: "size=l"
        });
    });
});

describe("distinctRecords", () => {
    it("keeps the first of a repeated (number, name)", () => {
        const [first, second] = unconfigured([
            record({
                partNumber: "WCP-1025",
                name: "Gear",
                values: { a: "1" }
            }),
            record({ partNumber: "WCP-1025", name: "Gear", values: { a: "2" } })
        ]);
        expect(distinctRecords([first, second])).toEqual([first]);
    });
});

function library(name: string, vendors: Vendor[] = []): LibraryOut {
    return {
        groupOrder: ["g1"],
        groups: {
            g1: {
                id: "g1",
                documentId: "d1",
                path: { documentId: "d1", instanceId: "v1", instanceType: "v" },
                name: "Group",
                isLoaded: true,
                insertableOrder: ["i1"]
            }
        },
        insertables: {
            i1: {
                id: "i1",
                elementId: "e1",
                groupId: "g1",
                documentId: "d1",
                versionId: "v1",
                path: {
                    documentId: "d1",
                    instanceId: "v1",
                    instanceType: "v",
                    elementId: "e1"
                },
                name,
                microversionId: "mv1",
                isVisible: true,
                supportsFasten: false,
                elementType: ElementType.PART_STUDIO,
                isConfigurable: false,
                vendors
            }
        }
    };
}

describe("buildSearchDb", () => {
    /** The document as the index stored it. */
    const stored = (db: ReturnType<typeof buildSearchDb>) =>
        db.getStoredFields("i1") as unknown as Record<string, unknown>;

    it("keeps a placeholder part number out of the index and the records", () => {
        const db = buildSearchDb(library("Spacer"), {
            i1: {
                parameters: [],
                records: [
                    record({
                        partNumber: "N/A",
                        name: "Spacer"
                    })
                ]
            }
        });
        expect(db.search("n/a")).toEqual([]);
        expect(stored(db).records).toEqual([
            expect.objectContaining({ partNumber: undefined })
        ]);
    });

    // The vendor is a resolution fallback, not something to match against.
    it("never searches the vendor", () => {
        const db = buildSearchDb(library("Spacer", [Vendor.WCP]), {
            i1: {
                parameters: [],
                records: [
                    record({
                        partNumber: "WCP-1025",
                        name: "Spacer",
                        vendor: "WestCoast Products"
                    })
                ]
            }
        });
        expect(db.search("westcoast")).toEqual([]);
        expect(stored(db).records).toEqual([
            expect.not.objectContaining({ vendor: expect.anything() })
        ]);
    });
});
