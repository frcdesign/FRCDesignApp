import { describe, expect, it } from "vitest";
import {
    nameSpans,
    partNumberSpans,
    queryWords,
    tokenize,
    type TermSpan
} from "./tokenize";

const terms = (spans: TermSpan[]) => [
    ...new Set(spans.map((span) => span.term))
];

/** Each span as the characters it covers, for checking offsets. */
const covered = (text: string, spans: TermSpan[]) =>
    spans.map((span) => text.slice(span.start, span.end));

// Read as typed, plus segments: splitting it would name a different part.
describe("partNumberSpans", () => {
    it("keeps the number whole, and adds its segments", () => {
        expect(terms(partNumberSpans("WCP-1025"))).toEqual([
            "wcp-1025",
            "wcp",
            "1025"
        ]);
    });

    it("keeps leading zeros and fractions as written", () => {
        expect(terms(partNumberSpans("TTB-0016-5/32"))).toEqual([
            "ttb-0016-5/32",
            "ttb",
            "0016",
            "5",
            "32"
        ]);
    });

    // The index joins an element's part numbers with spaces.
    it("reads space-separated part numbers apart", () => {
        const text = "WCP-0100 WCP-0101";
        const spans = partNumberSpans(text);
        expect(terms(spans)).toContain("wcp-0101");
        expect(terms(spans)).not.toContain(text.toLowerCase());
        expect(covered(text, spans)).toContain("WCP-0101");
    });

    it.each(["", "   "])("has nothing to say about %j", (value) => {
        expect(partNumberSpans(value)).toEqual([]);
    });
});

// A name describes the part, so its sizes are read as sizes.
describe("nameSpans", () => {
    it("splits on punctuation, inch marks included", () => {
        expect(terms(nameSpans('1" Linear (REV)'))).toEqual([
            "1",
            "linear",
            "rev"
        ]);
        expect(terms(nameSpans("Bearings & Bushings #X-Contact"))).toEqual([
            "bearings",
            "bushings",
            "x",
            "contact"
        ]);
    });

    it.each([
        ["1/2", ["0.5"]],
        [".5", ["0.5"]],
        ["0.50", ["0.5"]],
        ["3/4", ["0.75"]],
        ["1-1/2", ["1.5"]],
        ["1/3", ["0.33"]]
    ])("reads %s as a 2dp decimal", (text, expected) => {
        expect(terms(nameSpans(text))).toEqual(expected);
    });

    // Vendors write .196 as both .2 and .19.
    it("spells a measurement as what it rounds to and what it starts", () => {
        expect(terms(nameSpans(".196 ID Hub"))).toEqual([
            "0.2",
            "0.19",
            "id",
            "hub"
        ]);
    });

    it("keeps a thread spec's halves apart", () => {
        expect(terms(nameSpans("#10-32 Screw"))).toEqual(["10", "32", "screw"]);
    });

    it("reads a part number inside a name as part 16 in 5/32", () => {
        expect(terms(nameSpans("TTB-0016-5/32"))).toEqual([
            "ttb",
            "16",
            "0.16",
            "0.15"
        ]);
    });

    it("keeps a size's span on its written form", () => {
        const text = '1-1/2" Tube';
        expect(covered(text, nameSpans(text))).toEqual(["1-1/2", "Tube"]);
    });

    it("adds the words of a compound, where they sit", () => {
        const text = "MAXSpline";
        const spans = nameSpans(text);
        expect(terms(spans)).toEqual(["maxspline", "max", "spline"]);
        expect(covered(text, spans)).toEqual(["MAXSpline", "MAX", "Spline"]);
    });

    it.each([
        ["roboRIO", ["robo", "rio"]],
        ["SplineXL", ["spline", "xl"]]
    ])("splits the product name %s", (text, words) => {
        expect(terms(nameSpans(text))).toEqual(expect.arrayContaining(words));
    });

    it("marks only an unchanged spelling as literal", () => {
        expect(nameSpans("Bracket")[0].literal).toBe(true);
        expect(nameSpans("1/2")[0].literal).toBe(false);
        expect(nameSpans("0016")[0].literal).toBe(false);
    });
});

describe("tokenize", () => {
    it("reads each field the way that field is written", () => {
        expect(tokenize("TTB-0016-5/32", "partNumbers")).toContain("0016");
        expect(tokenize("TTB-0016-5/32", "partNames")).not.toContain("0016");
    });
});

// A query word could be a size or a part number, so it's read both ways.
describe("queryWords", () => {
    it("offers a part number as typed, and as a name would read it", () => {
        expect(queryWords("TTB-0016")).toEqual([
            expect.arrayContaining(["ttb", "16", "0016", "ttb-0016"])
        ]);
    });

    // A bare `1` would prefix-match every number.
    it("does not split a bare size into its digits", () => {
        expect(queryWords("1/2")).toEqual([["0.5", "1/2"]]);
    });

    it("keeps the words apart, since each has to match", () => {
        expect(queryWords("L bracket")).toEqual([["l"], ["bracket"]]);
    });

    // Splitting it leaves one-letter prefixes that match most of the library.
    it.each(["n/a", "N/A"])("has nothing to search for in %s", (query) => {
        expect(queryWords(query)).toEqual([]);
    });

    it("still reads the rest of a query the placeholder is in", () => {
        expect(queryWords("n/a bearing")).toEqual([["bearing"]]);
    });
});
