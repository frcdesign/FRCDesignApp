import { describe, expect, it } from "vitest";
import MiniSearch from "minisearch";
import {
    buildSearchDb,
    type SearchDocument
} from "@backend/features/search/search-index";
import { doSearch, type Position } from "./search";
import { LibraryOut } from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { ConfigurationRecord } from "@backend/features/configurations/models";
import { configurationRecord } from "../../../__test_utils__/configuration-fixtures";

const record = (
    partNumber: string | undefined,
    configurationKey: string,
    name?: string
) => configurationRecord({ partNumber, configurationKey, name });

/** Hidden insertables shown: these tests are about matching, not visibility. */
const search = (searchDb: MiniSearch<SearchDocument>, query: string) =>
    doSearch(searchDb, query, undefined, undefined, true);

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
            record("217-2600", "length=short"),
            record("217-2601", "length=long")
        ]
    };

    it("matches a part number and returns its configuration", () => {
        const searchDb = buildSearchDb(library(), recordsMap);
        const { hits } = search(searchDb, "217-2601");
        expect(hits).toHaveLength(1);
        expect(hits[0].id).toBe("i1");
        expect(hits[0].configurationKey).toBe("length=long");
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
        expect(hits[0].configurationKey).toBe("length=short");
        expect(hits[0].partNumber).toBe("217-2600");
    });

    // Older revisions share a part number with the latest, which enumerates
    // first. First-wins folding must keep that latest configuration.
    it("resolves a shared part number to the latest (first-listed) configuration", () => {
        const searchDb = buildSearchDb(library(), {
            i1: [
                record("217-2600", "version=latest"),
                record("217-2600", "version=older")
            ]
        });
        const { hits } = search(searchDb, "217-2600");
        expect(hits).toHaveLength(1);
        expect(hits[0].configurationKey).toBe("version=latest");
    });
});

// Production shape: the element's own part data leads the list as the record an
// unset configuration falls back to, followed by one record per configuration.
describe("doSearch configuration matching", () => {
    const searchDb = buildSearchDb(library("MAXSpline Gear"), {
        i1: [
            record("WCP-1234", "", "12T MAXSpline Gear"),
            record("WCP-1235", "teeth=24", "24T MAXSpline Gear"),
            record("WCP-1236", "teeth=36", "36T MAXSpline Gear")
        ]
    });

    it("picks the configuration a term of the query names", () => {
        const { hits } = search(searchDb, "maxspline 24t");
        expect(hits[0].configurationKey).toBe("teeth=24");
        expect(hits[0].partNumber).toBe("WCP-1235");
    });

    it("picks it from the distinguishing term alone", () => {
        const { hits } = search(searchDb, "36t");
        expect(hits[0].configurationKey).toBe("teeth=36");
    });

    it("keeps the default when no term distinguishes a configuration", () => {
        const { hits } = search(searchDb, "maxspline gear");
        expect(hits[0].configurationKey).toBe("");
    });

    it("lets a part number typed in full outrank a looser name match", () => {
        const { hits } = search(searchDb, "WCP-1236");
        expect(hits[0].configurationKey).toBe("teeth=36");
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

// A part number carries digits of its own, so `1` prefix-matches a segment of
// every one of them; the size in the name is what the query actually named.
describe("doSearch size matching", () => {
    const searchDb = buildSearchDb(library("Hex Standoff"), {
        i1: [
            record("TTB-0016-025", "length=0.25 in", '0.25" Hex Standoff'),
            record("TTB-0016-050", "length=0.5 in", '0.5" Hex Standoff'),
            record("TTB-0016-100", "length=1 in", '1" Hex Standoff')
        ]
    });

    it.each(["1", '1"', "1 in", "1 standoff"])(
        "picks the 1 inch configuration for %s",
        (query) => {
            const { hits } = search(searchDb, query);
            expect(hits[0].partName).toBe('1" Hex Standoff');
            expect(hits[0].configurationKey).toBe("length=1 in");
        }
    );

    it("still picks the smaller size when that is what was asked for", () => {
        const { hits } = search(searchDb, ".25 standoff");
        expect(hits[0].partName).toBe('0.25" Hex Standoff');
    });

    // Nothing in the query distinguishes one, so the default still leads.
    it("keeps the default when no size is named", () => {
        const { hits } = search(searchDb, "hex standoff");
        expect(hits[0].partName).toBe('0.25" Hex Standoff');
    });
});

// The same measurement is written .196, .2 and .19 across the library, so a
// part is stored as both spellings and either one finds it.
describe("doSearch measurements", () => {
    const searchDb = buildSearchDb(library("MotionX Hub"), {
        i1: [record("WCP-1", "", ".196 ID x SplineXL OD")]
    });

    it.each([".196", ".19", ".2", "0.19"])("finds the part by %s", (query) => {
        expect(search(searchDb, query).hits[0]?.id).toBe("i1");
    });
});

// Results arrive as the caller types, and the first keystroke is one letter.
describe("doSearch single letters", () => {
    const searchDb = buildSearchDb(library("Hex Standoff"), {
        i1: [record("TTB-0016", "", "Standoff")]
    });

    it.each(["h", "s", "t"])("answers a typed %s", (query) => {
        expect(search(searchDb, query).hits[0]?.id).toBe("i1");
    });
});

// A part number is a code: it retrieves its part whole, by either half, and
// with the zeros and separators it was written with.
describe("doSearch part numbers", () => {
    const searchDb = buildSearchDb(library("Hex Standoff"), {
        i1: [
            record("WCP-1025", "", "Standoff"),
            record("TTB-0016-5/32", "size=small", "Small Standoff")
        ]
    });

    it.each(["WCP-1025", "wcp-1025", "WCP", "1025"])(
        "finds the part by %s",
        (query) => {
            const { hits } = search(searchDb, query);
            expect(hits[0]?.id).toBe("i1");
        }
    );

    it("keeps the zeros a segment was written with", () => {
        expect(search(searchDb, "0016").hits[0]?.partNumber).toBe(
            "TTB-0016-5/32"
        );
    });

    it("picks the record whose number was typed out in full", () => {
        expect(search(searchDb, "WCP-1025").hits[0].partNumber).toBe(
            "WCP-1025"
        );
        expect(search(searchDb, "TTB-0016-5/32").hits[0].partNumber).toBe(
            "TTB-0016-5/32"
        );
    });

    // The placeholder never reaches the index, so it matches nothing rather
    // than every part an admin left it on.
    it("returns nothing for the placeholder", () => {
        const withPlaceholders = buildSearchDb(library("Spacer"), {
            i1: [record("N/A", "", "Spacer")]
        });
        expect(search(withPlaceholders, "n/a").hits).toEqual([]);
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
            i1: [record("217-2600", "length=short", "Long Bearing")]
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

        // A part number is indexed as typed, so the whole of what was typed
        // is there in the text to underline, dash and zeros included.
        it("underlines a leading-zero segment of the part number", () => {
            const { hits } = search(
                buildSearchDb(library(), {
                    i1: [record("TTB-0016-5/32", "size=small")]
                }),
                "TTB-0016"
            );
            expect(
                highlighted(
                    hits[0].partNumber!,
                    hits[0].partNumberPositions ?? []
                )
            ).toBe("TTB-0016");
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
            record("217-2600", "length=short", "1/2 Bearing"),
            record("217-2601", "length=long", "3/4 Bearing")
        ]
    };

    it("matches a part name, returning its number, name, and configuration", () => {
        const searchDb = buildSearchDb(library(), recordsMap);
        const { hits } = search(searchDb, "3/4 bearing");
        expect(hits).toHaveLength(1);
        expect(hits[0].partName).toBe("3/4 Bearing");
        expect(hits[0].partNumber).toBe("217-2601");
        expect(hits[0].configurationKey).toBe("length=long");
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
