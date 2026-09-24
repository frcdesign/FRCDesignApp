import { describe, expect, it } from "vitest";
import {
    normalizeForMatch,
    processTerm,
    tokenize,
    tokenizeName,
    tokenizePartNumber,
    tokenizeQuery
} from "./tokenize";

// Indexed as typed, plus segments: splitting it would name a different part.
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

    // Vendors write .196 as both .2 and .19.
    it("spells a measurement as what it rounds to and what it starts", () => {
        expect(tokenizeName(".196 ID Hub")).toEqual([
            "0.2",
            "ID",
            "Hub",
            "0.19"
        ]);
        expect(tokenizeName('2.140" L')).toEqual(['2.14"', "L"]);
    });

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

// A query could be a size or a part number, so it's read both ways.
describe("tokenizeQuery", () => {
    it("offers the part number as typed, and as a name would read it", () => {
        expect(
            tokenizeQuery("TTB-0016").map((term) => term.toLowerCase())
        ).toEqual(expect.arrayContaining(["ttb", "16", "0016", "ttb-0016"]));
    });

    // A bare `1` would prefix-match every number.
    it("does not split a bare size into its digits", () => {
        expect(tokenizeQuery("1/2")).toEqual(["0.5", "1/2"]);
    });

    it("leaves an ordinary word alone", () => {
        expect(tokenizeQuery("bearing")).toEqual(["bearing"]);
    });

    // Splitting it leaves one-letter prefixes that match most of the library.
    it.each(["n/a", "N/A"])("has nothing to search for in %s", (query) => {
        expect(tokenizeQuery(query)).toEqual([]);
    });

    it("still reads the rest of a query the placeholder is in", () => {
        expect(tokenizeQuery("n/a bearing")).toEqual(["bearing"]);
    });

    // Search answers from the first keystroke.
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
