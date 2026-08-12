import { describe, expect, it } from "vitest";
import { buildSearchDb, processTerm, tokenize } from "../../shared/search";
import { doSearch, type Position } from "./search";
import { LibraryOut } from "../../shared/api-models";
import { ElementType } from "../../shared/types";
import {
    ConfigurationRecord,
    ParameterValues
} from "../../shared/configuration-models";

/** Builds a configuration record carrying a part number, name, + configuration. */
function record(
    partNumber: string | null,
    configuration: ParameterValues,
    name: string | null = null
): ConfigurationRecord {
    return {
        configuration,
        partNumber,
        name,
        description: null,
        material: null,
        vendor: null,
        hasMultipleParts: false,
        isUnstableComposite: false
    };
}

describe("processTerm", () => {
    it("should process camelCase", () => {
        const result = processTerm("MAXSpline");
        expect(result).toEqual(
            expect.arrayContaining(["max", "spline", "maxspline"])
        );
    });

    it("should process CapitalCase", () => {
        const result = processTerm("MaxSpline");
        expect(result).toEqual(
            expect.arrayContaining(["max", "spline", "maxspline"])
        );
    });
});

describe("tokenize", () => {
    it("should keep quotes", () => {
        const result = tokenize('1" Linear (REV)');
        expect(result).toEqual(["1", "Linear", "REV"]);
    });

    it("should strip punctuation", () => {
        const result = tokenize("10-32 Bearings & Bushings #X-Contact");
        expect(result).toEqual([
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

    it("leaves thread specs and part numbers untouched", () => {
        expect(tokenize("10-32")).toEqual(["10", "32"]);
        expect(tokenize("217-2600")).toEqual(["217", "2600"]);
    });

    it("canonicalizes a fraction inside a name", () => {
        expect(tokenize("1/2 Bearing")).toEqual(["0.5", "Bearing"]);
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
        const { hits } = doSearch(
            searchDb,
            "217-2601",
            undefined,
            undefined,
            true
        );
        expect(hits).toHaveLength(1);
        expect(hits[0].id).toBe("i1");
        expect(hits[0].configuration).toEqual({ length: "long" });
    });

    it("attaches the default (first) record for a title match", () => {
        const searchDb = buildSearchDb(library(), recordsMap);
        const { hits } = doSearch(
            searchDb,
            "Bracket",
            undefined,
            undefined,
            true
        );
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
        const { hits } = doSearch(
            searchDb,
            "217-2600",
            undefined,
            undefined,
            true
        );
        expect(hits).toHaveLength(1);
        expect(hits[0].configuration).toEqual({ version: "latest" });
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
        const { hits } = doSearch(
            buildSearchDb(library(name)),
            query,
            undefined,
            undefined,
            true
        );
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

    it("matches terms literally rather than as patterns", () => {
        // An unescaped "1.5" would also underline the "125".
        expect(highlightFor("1.5 x 125 Spacer", "1.5")).toBe("1.5");
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
        const { hits } = doSearch(
            searchDb,
            "3/4 bearing",
            undefined,
            undefined,
            true
        );
        expect(hits).toHaveLength(1);
        expect(hits[0].partName).toBe("3/4 Bearing");
        expect(hits[0].partNumber).toBe("217-2601");
        expect(hits[0].configuration).toEqual({ length: "long" });
    });

    it("finds a fractional name by its decimal forms (.5, 0.5, 1/2)", () => {
        const searchDb = buildSearchDb(library(), recordsMap);
        for (const query of [".5", "0.5", "1/2"]) {
            const { hits } = doSearch(
                searchDb,
                query,
                undefined,
                undefined,
                true
            );
            const hit = hits.find((h) => h.id === "i1");
            expect(hit?.partName).toBe("1/2 Bearing");
        }
    });
});
