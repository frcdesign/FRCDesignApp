import { describe, expect, it } from "vitest";
import {
    buildSearchDb,
    normalizeForMatch,
    processTerm,
    tokenize,
    tokenizeName,
    tokenizePartNumber,
    tokenizeQuery,
    toSearchRecords
} from "./search-index";
import { LibraryOut } from "../library/contract";
import { ElementType } from "../../lib/onshape/element-type";
import { Vendor } from "../library/vendors";
import { configurationRecord as record } from "../../../__test_utils__/configuration-fixtures";

// A part number identifies the part; splitting or folding it makes it name a
// different one, so it is indexed as typed alongside its segments.
describe("tokenizePartNumber", () => {
    it("keeps the number whole, and adds its segments", () => {
        expect(tokenizePartNumber("WCP-1025")).toEqual([
            "wcp-1025",
            "wcp",
            "1025"
        ]);
    });

    it("keeps leading zeros, which spell the segment", () => {
        expect(tokenizePartNumber("TTB-0016")).toEqual([
            "ttb-0016",
            "ttb",
            "0016"
        ]);
    });

    it("leaves a fraction inside a number alone", () => {
        expect(tokenizePartNumber("TTB-0016-5/32")).toEqual([
            "ttb-0016-5/32",
            "ttb",
            "0016",
            "5",
            "32"
        ]);
    });

    it("does not read a number as a quantity", () => {
        expect(tokenizePartNumber("217-2600")).toEqual([
            "217-2600",
            "217",
            "2600"
        ]);
    });

    it.each(["", "   "])("has nothing to say about %s", (value) => {
        expect(tokenizePartNumber(value)).toEqual([]);
    });
});

// A name describes the part, so its sizes are read as sizes.
describe("tokenizeName", () => {
    it("splits on punctuation, keeping the words whole", () => {
        expect(tokenizeName('1" Linear (REV)')).toEqual([
            '1"',
            "Linear",
            "REV"
        ]);
        expect(tokenizeName("Bearings & Bushings #X-Contact")).toEqual([
            "Bearings",
            "Bushings",
            "X",
            "Contact"
        ]);
    });

    // The standards write the same measurement both ways, so one decimal form
    // is what lets either spelling find the other.
    it("canonicalizes fractions and decimals to a 2-dp decimal", () => {
        expect(tokenizeName("1/2")).toEqual(["0.5"]);
        expect(tokenizeName(".5")).toEqual(["0.5"]);
        expect(tokenizeName("0.50")).toEqual(["0.5"]);
        expect(tokenizeName("3/4")).toEqual(["0.75"]);
        expect(tokenizeName("1-1/2")).toEqual(["1.5"]);
        expect(tokenizeName("1/3")).toEqual(["0.33"]);
    });

    it.each([
        ['1/2" Hex Bearing (1.125" OD, 0.313" WD, Flanged)', '0.5"'],
        // Stored to 2dp, so `1.125` and `1.13` are one size.
        ['1/2" Hex Bearing (1.125" OD, 0.313" WD, Flanged)', '1.13"'],
        ['#10-32 x 2.5" L SHCS', "10"],
        // Sizes are stored to 2dp, so `.159` and `.16` are one size.
        [".159 ID x SplineXL OD MotionX Hub", "0.16"]
    ])("reads the sizes in %s", (name, size) => {
        expect(tokenizeName(name)).toContain(size);
    });

    it("keeps a thread spec's halves apart", () => {
        expect(tokenizeName("#10-32 Screw")).toEqual(["10", "32", "Screw"]);
    });

    // The standards list a part's dimensions in a comma-separated aside.
    it("does not leave a comma stuck to the word before it", () => {
        expect(tokenizeName('1.125" OD, Flanged')).toEqual([
            '1.13"',
            "OD",
            "Flanged",
            '1.12"'
        ]);
    });

    // One vendor writes .196 as .2 and the next writes .19, so the part is
    // stored as both and either spelling finds it.
    it("spells a measurement as what it rounds to and what it starts", () => {
        expect(tokenizeName(".196 ID Hub")).toEqual([
            "0.2",
            "ID",
            "Hub",
            "0.19"
        ]);
        expect(tokenizeName('2.140" L')).toEqual(['2.14"', "L"]);
    });

    // The mark is what makes `1"` a size rather than a prefix of 1.5 and 16T.
    it("keeps an inch mark on the number it measures", () => {
        expect(tokenizeName('1" Hex Shaft')).toEqual(['1"', "Hex", "Shaft"]);
        expect(tokenizeName('1/2" Hex')).toEqual(['0.5"', "Hex"]);
        expect(tokenizeName('1"x2" Tube')).toEqual(['1"', 'x2"', "Tube"]);
    });

    it("still drops quotes that quote something", () => {
        expect(tokenizeName('The "Long" Bracket')).toEqual([
            "The",
            "Long",
            "Bracket"
        ]);
    });
});

describe("processTerm", () => {
    it.each(["MAXSpline", "MaxSpline"])("splits %s into its words", (term) => {
        expect(processTerm(term)).toEqual(
            expect.arrayContaining(["max", "spline", "maxspline"])
        );
    });

    it.each([
        ["SplineXL", ["spline", "xl"]],
        ["roboRIO", ["robo", "rio"]],
        ["MAXTube", ["max", "tube"]]
    ])("splits the product name %s", (term, words) => {
        expect(processTerm(term)).toEqual(expect.arrayContaining(words));
    });

    // Its segments are already separate tokens; splitting the code again would
    // only invent words inside it.
    it("leaves a part number whole", () => {
        expect(processTerm("WCP-1025", "partNumbers")).toEqual(["wcp-1025"]);
    });
});

describe("tokenize", () => {
    it("reads each field the way that field is written", () => {
        expect(tokenize("TTB-0016-5/32", "partNumbers")).toContain("0016");
        expect(tokenize("TTB-0016-5/32", "partNames")).toEqual([
            "TTB",
            "16",
            "0.16",
            "0.15"
        ]);
    });
});

// A query has no field, so it has to offer both readings: the caller may have
// typed a size or a part number.
describe("tokenizeQuery", () => {
    it("offers the part number as typed, and as a name would read it", () => {
        expect(
            tokenizeQuery("TTB-0016").map((term) => term.toLowerCase())
        ).toEqual(expect.arrayContaining(["ttb", "16", "0016", "ttb-0016"]));
    });

    // `1` prefix-matches every number in the library, so a size is not split
    // into the segments a part number would be.
    it("does not split a bare size into its digits", () => {
        expect(tokenizeQuery("1/2")).toEqual(["0.5", "1/2"]);
    });

    it("leaves an ordinary word alone", () => {
        expect(tokenizeQuery("bearing")).toEqual(["bearing"]);
    });

    // Splitting the placeholder leaves `n` and `a`, and a one-letter prefix
    // matches most of the library.
    // Nothing carries the placeholder, and searching its letters would answer
    // with whatever starts with `n` or `a`.
    it.each(["n/a", "N/A"])("has nothing to search for in %s", (query) => {
        expect(tokenizeQuery(query)).toEqual([]);
    });

    it("still reads the rest of a query the placeholder is in", () => {
        expect(tokenizeQuery("n/a bearing")).toEqual(["bearing"]);
    });

    // Answering as the caller types is the point, and the first keystroke is
    // one character.
    it.each(["l", "L", "1"])("still searches for a typed %s", (query) => {
        expect(tokenizeQuery(query)).toEqual([query]);
    });

    it("keeps a letter typed beside another word", () => {
        expect(tokenizeQuery("L bracket")).toEqual(["L", "bracket"]);
    });
});

describe("normalizeForMatch", () => {
    it("reads a written size and its decimal as one string", () => {
        expect(normalizeForMatch('1/2" Hex')).toBe(
            normalizeForMatch('.5" hex')
        );
    });
});

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

    // The placeholder an admin writes in identifies nothing, so it is dropped
    // here rather than indexed and shown.
    it("drops a placeholder part number", () => {
        const [result] = toSearchRecords([
            record({ partNumber: "N/A", name: "Spacer" })
        ]);
        expect(result).toMatchObject({ partNumber: undefined, name: "Spacer" });
    });

    it("will not link a placeholder to a vendor", () => {
        const [result] = toSearchRecords(
            [record({ partNumber: "N/A", name: "Spacer" })],
            [Vendor.WCP]
        );
        expect(result.url).toBeUndefined();
    });

    it("drops a record the placeholder leaves with nothing", () => {
        expect(toSearchRecords([record({ partNumber: "N/A" })])).toEqual([]);
    });

    it("keeps the first of a repeated (number, name)", () => {
        expect(
            toSearchRecords([
                record({ partNumber: "WCP-1025", name: "Gear" }),
                record({ partNumber: "WCP-1025", name: "Gear" })
            ])
        ).toHaveLength(1);
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
            i1: [
                record({
                    partNumber: "N/A",
                    name: "Spacer",
                    configuration: {}
                })
            ]
        });
        expect(db.search("n/a")).toEqual([]);
        expect(stored(db).records).toEqual([
            expect.objectContaining({ partNumber: undefined })
        ]);
    });

    // The vendor is a resolution fallback, not something to match against.
    it("never searches the vendor", () => {
        const db = buildSearchDb(library("Spacer", [Vendor.WCP]), {
            i1: [
                record({
                    partNumber: "WCP-1025",
                    name: "Spacer",
                    vendor: "WestCoast Products",
                    configuration: {}
                })
            ]
        });
        expect(db.search("westcoast")).toEqual([]);
        expect(stored(db).records).toEqual([
            expect.not.objectContaining({ vendor: expect.anything() })
        ]);
    });
});
