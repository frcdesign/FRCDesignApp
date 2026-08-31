import { describe, expect, it } from "vitest";
import MiniSearch from "minisearch";
import {
    buildSearchDb,
    processTerm,
    tokenize,
    type SearchDocument
} from "@backend/features/search/search-index";
import { doSearch, type Position } from "./search";
import { LibraryOut } from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    ConfigurationRecord,
    ParameterValues
} from "@backend/features/configurations/models";
import { configurationRecord } from "../../../__test_utils__/configuration-fixtures";

const record = (
    partNumber: string | undefined,
    configuration: ParameterValues,
    name?: string
) => configurationRecord({ partNumber, configuration, name });

/** Hidden insertables shown: these tests are about matching, not visibility. */
const search = (searchDb: MiniSearch<SearchDocument>, query: string) =>
    doSearch(searchDb, query, undefined, undefined, true);

describe("processTerm", () => {
    it.each(["MAXSpline", "MaxSpline"])("splits %s into its words", (term) => {
        expect(processTerm(term)).toEqual(
            expect.arrayContaining(["max", "spline", "maxspline"])
        );
    });
});

describe("tokenize", () => {
    it("splits on punctuation, keeping the words whole", () => {
        expect(tokenize('1" Linear (REV)')).toEqual(['1"', "Linear", "REV"]);
        expect(tokenize("10-32 Bearings & Bushings #X-Contact")).toEqual([
            "10",
            "32",
            "Bearings",
            "Bushings",
            "X",
            "Contact"
        ]);
    });

    it("canonicalizes fractions and decimals to a 2-dp decimal", () => {
        expect(tokenize("1/2")).toEqual(["0.5"]);
        expect(tokenize(".5")).toEqual(["0.5"]);
        expect(tokenize("0.50")).toEqual(["0.5"]);
        expect(tokenize("3/4")).toEqual(["0.75"]);
        expect(tokenize("1-1/2")).toEqual(["1.5"]);
        expect(tokenize("1.5")).toEqual(["1.5"]);
        expect(tokenize("1/3")).toEqual(["0.33"]);
    });

    it("keeps a leading-zero part segment out of a mixed number", () => {
        // "0016" numbers the part; only the "5/32" is a size.
        expect(tokenize("TTB-0016-5/32")).toEqual(["TTB", "16", "0.16"]);
    });

    it("drops leading zeros so either spelling of a segment matches", () => {
        expect(tokenize("TTB-0016")).toEqual(["TTB", "16"]);
        expect(tokenize("TTB-16")).toEqual(["TTB", "16"]);
    });

    it("leaves thread specs and part numbers untouched", () => {
        expect(tokenize("10-32")).toEqual(["10", "32"]);
        expect(tokenize("217-2600")).toEqual(["217", "2600"]);
    });

    it("canonicalizes a fraction inside a name", () => {
        expect(tokenize("1/2 Bearing")).toEqual(["0.5", "Bearing"]);
    });

    // The mark is what makes `1"` a size rather than a prefix of 1.5 and 16T.
    it("keeps an inch mark on the number it measures", () => {
        expect(tokenize('1" Hex Shaft')).toEqual(['1"', "Hex", "Shaft"]);
        expect(tokenize('1/2" Hex')).toEqual(['0.5"', "Hex"]);
        expect(tokenize('Bearing 1"')).toEqual(["Bearing", '1"']);
    });

    it("still drops quotes that quote something", () => {
        expect(tokenize('The "Long" Bracket')).toEqual([
            "The",
            "Long",
            "Bracket"
        ]);
    });
});

function library(name = "Bracket"): LibraryOut {
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
                vendors: []
            }
        }
    };
}

describe("doSearch part-number matching", () => {
    const recordsMap: Record<string, ConfigurationRecord[]> = {
        i1: [
            record("217-2600", { length: "short" }),
            record("217-2601", { length: "long" })
        ]
    };

    it("matches a part number and returns its configuration", () => {
        const searchDb = buildSearchDb(library(), recordsMap);
        const { hits } = search(searchDb, "217-2601");
        expect(hits).toHaveLength(1);
        expect(hits[0].id).toBe("i1");
        expect(hits[0].configuration).toEqual({ length: "long" });
    });

    // "Bracket 217" matches the part-number field on "217", but no single record
    // matches the whole query — the row must still show a part number.
    it("falls back to the default record when no one record matches the query", () => {
        const searchDb = buildSearchDb(library(), recordsMap);
        const { hits } = search(searchDb, "Bracket 217");
        expect(hits).toHaveLength(1);
        expect(hits[0].partNumber).toBe("217-2600");
    });

    it("attaches the default (first) record for a title match", () => {
        const searchDb = buildSearchDb(library(), recordsMap);
        const { hits } = search(searchDb, "Bracket");
        expect(hits).toHaveLength(1);
        // The insertable's own name matched, so the row shows its default config.
        expect(hits[0].configuration).toEqual({ length: "short" });
        expect(hits[0].partNumber).toBe("217-2600");
    });

    // Older revisions share a part number with the latest, which enumerates
    // first. First-wins folding must keep that latest configuration.
    it("resolves a shared part number to the latest (first-listed) configuration", () => {
        const searchDb = buildSearchDb(library(), {
            i1: [
                record("217-2600", { version: "latest" }),
                record("217-2600", { version: "older" })
            ]
        });
        const { hits } = search(searchDb, "217-2600");
        expect(hits).toHaveLength(1);
        expect(hits[0].configuration).toEqual({ version: "latest" });
    });
});

// Production shape: the element's own part data leads the list as the record an
// unset configuration falls back to, followed by one record per configuration.
describe("doSearch configuration matching", () => {
    const searchDb = buildSearchDb(library("MAXSpline Gear"), {
        i1: [
            record("WCP-1234", {}, "12T MAXSpline Gear"),
            record("WCP-1235", { teeth: "24" }, "24T MAXSpline Gear"),
            record("WCP-1236", { teeth: "36" }, "36T MAXSpline Gear")
        ]
    });

    it("picks the configuration a term of the query names", () => {
        const { hits } = search(searchDb, "maxspline 24t");
        expect(hits[0].configuration).toEqual({ teeth: "24" });
        expect(hits[0].partNumber).toBe("WCP-1235");
    });

    it("picks it from the distinguishing term alone", () => {
        const { hits } = search(searchDb, "36t");
        expect(hits[0].configuration).toEqual({ teeth: "36" });
    });

    it("keeps the default when no term distinguishes a configuration", () => {
        const { hits } = search(searchDb, "maxspline gear");
        expect(hits[0].configuration).toEqual({});
    });

    it("lets a part number typed in full outrank a looser name match", () => {
        const { hits } = search(searchDb, "WCP-1236");
        expect(hits[0].configuration).toEqual({ teeth: "36" });
    });
});

// A bare `1` prefix-matches every 1.5", 10-32 and 16T in the library; typing
// the inch mark is how a user says they mean one inch exactly.
describe("doSearch inch sizes", () => {
    const names = [
        '1" Hex Shaft',
        '1/2" Hex Shaft',
        '1.5" Spacer',
        "10-32 Screw",
        "16T Pulley"
    ];

    /** One library holding all of `names`, so a query has to choose. */
    function sizeLibrary(): LibraryOut {
        const base = library();
        const template = base.insertables.i1;
        base.insertables = {};
        base.groups.g1.insertableOrder = names.map((name, index) => {
            const id = "size" + index;
            base.insertables[id] = { ...template, id, name };
            return id;
        });
        return base;
    }

    const searchDb = buildSearchDb(sizeLibrary());
    const namesFor = (query: string) =>
        search(searchDb, query).hits.map(
            (hit) => names[Number(hit.id.slice("size".length))]
        );

    it("matches only the parts measured in that size", () => {
        expect(namesFor('1"')).toEqual(['1" Hex Shaft']);
    });

    it("finds a fractional size by its decimal form", () => {
        expect(namesFor('.5"')).toEqual(['1/2" Hex Shaft']);
    });

    // Without the mark there is nothing to say 1 is a size, so it stays a
    // prefix — of 1.5, 10 and 16 alike, but not of the 1/2 stored as 0.5.
    it("leaves a bare number matching every number it starts", () => {
        expect(namesFor("1").sort()).toEqual(
            ['1" Hex Shaft', '1.5" Spacer', "10-32 Screw", "16T Pulley"].sort()
        );
    });
});

describe("doSearch highlighting", () => {
    /** The characters `positions` underline, merged the way applyRanges does. */
    function highlighted(text: string, positions: Position[]): string {
        const covered = new Set<number>();
        for (const { start, length } of positions) {
            for (let i = start; i < start + length; i++) {
                covered.add(i);
            }
        }
        return [...text].filter((_, i) => covered.has(i)).join("");
    }

    function highlightFor(name: string, query: string): string {
        const { hits } = search(buildSearchDb(library(name)), query);
        expect(hits).toHaveLength(1);
        return highlighted(name, hits[0].positions);
    }

    it("underlines only the typed prefix, not the whole matched term", () => {
        expect(highlightFor("Bracket", "brack")).toBe("Brack");
    });

    it("underlines the whole term for an exact match", () => {
        expect(highlightFor("Bracket", "bracket")).toBe("Bracket");
    });

    it("underlines a prefix spanning camelCase sub-terms", () => {
        expect(highlightFor("MAXSpline", "maxsp")).toBe("MAXSp");
    });

    it("underlines a prefix of a later word", () => {
        expect(highlightFor("Motor Mount", "mou")).toBe("Mou");
    });

    it("underlines the inch mark along with its number", () => {
        expect(highlightFor('1" Hex Shaft', '1"')).toBe('1"');
    });

    it("matches terms literally rather than as patterns", () => {
        // An unescaped "1.5" would also underline the "125".
        expect(highlightFor("1.5 x 125 Spacer", "1.5")).toBe("1.5");
    });

    // The row shows the matched configuration's part number and name beneath
    // the title, so the query has to be underlined there too.
    describe("of the matched record", () => {
        const recordsMap: Record<string, ConfigurationRecord[]> = {
            i1: [record("217-2600", { length: "short" }, "Long Bearing")]
        };

        function hitFor(query: string) {
            const { hits } = search(
                buildSearchDb(library(), recordsMap),
                query
            );
            expect(hits).toHaveLength(1);
            return hits[0];
        }

        it("underlines the typed prefix of the part number", () => {
            const hit = hitFor("217");
            expect(
                highlighted(hit.partNumber!, hit.partNumberPositions ?? [])
            ).toBe("217");
        });

        // The segment after a leading-zero one used to be folded into a mixed
        // number, leaving nothing in the text for the query to underline.
        it("underlines a leading-zero segment of the part number", () => {
            const { hits } = search(
                buildSearchDb(library(), {
                    i1: [record("TTB-0016-5/32", { size: "small" })]
                }),
                "TTB-0016"
            );
            expect(
                highlighted(
                    hits[0].partNumber!,
                    hits[0].partNumberPositions ?? []
                )
            ).toBe("TTB0016");
        });

        it("underlines the typed prefix of the part name", () => {
            const hit = hitFor("bear");
            expect(
                highlighted(hit.partName!, hit.partNamePositions ?? [])
            ).toBe("Bear");
        });

        // A title match shows the default record, but nothing in it matched.
        it("underlines nothing when only the title matched", () => {
            const hit = hitFor("bracket");
            expect(
                highlighted(hit.partNumber!, hit.partNumberPositions ?? [])
            ).toBe("");
            expect(
                highlighted(hit.partName!, hit.partNamePositions ?? [])
            ).toBe("");
        });
    });
});

describe("doSearch name matching", () => {
    const recordsMap: Record<string, ConfigurationRecord[]> = {
        i1: [
            record("217-2600", { length: "short" }, "1/2 Bearing"),
            record("217-2601", { length: "long" }, "3/4 Bearing")
        ]
    };

    it("matches a part name, returning its number, name, and configuration", () => {
        const searchDb = buildSearchDb(library(), recordsMap);
        const { hits } = search(searchDb, "3/4 bearing");
        expect(hits).toHaveLength(1);
        expect(hits[0].partName).toBe("3/4 Bearing");
        expect(hits[0].partNumber).toBe("217-2601");
        expect(hits[0].configuration).toEqual({ length: "long" });
    });

    it("finds a fractional name by its decimal forms (.5, 0.5, 1/2)", () => {
        const searchDb = buildSearchDb(library(), recordsMap);
        for (const query of [".5", "0.5", "1/2"]) {
            const { hits } = search(searchDb, query);
            const hit = hits.find((h) => h.id === "i1");
            expect(hit?.partName).toBe("1/2 Bearing");
        }
    });
});
