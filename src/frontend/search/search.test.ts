import { describe, expect, it } from "vitest";
import { buildSearchDb, processTerm, tokenize } from "../../shared/search";
import { doSearch } from "./search";
import { LibraryOut } from "../../shared/api-models";
import { ElementType, ThumbnailUrls } from "../../shared/types";
import { PartNumberMap } from "../../shared/configuration-models";

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
});

const thumbnailUrls = {} as ThumbnailUrls;

function library(): LibraryOut {
    return {
        groupOrder: ["g1"],
        groups: {
            g1: {
                id: "g1",
                documentId: "d1",
                path: { documentId: "d1", instanceId: "v1", instanceType: "v" },
                name: "Group",
                thumbnailUrls,
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
                name: "Bracket",
                microversionId: "mv1",
                isVisible: true,
                supportsFasten: false,
                elementType: ElementType.PART_STUDIO,
                thumbnailUrls,
                vendors: []
            }
        }
    };
}

describe("doSearch part-number matching", () => {
    const partNumberMap: Record<string, PartNumberMap> = {
        i1: {
            "217-2600": { length: "short" },
            "217-2601": { length: "long" }
        }
    };

    it("matches a part number and returns its configuration", () => {
        const searchDb = buildSearchDb(library(), partNumberMap);
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

    it("does not attach a configuration for a name match", () => {
        const searchDb = buildSearchDb(library(), partNumberMap);
        const { hits } = doSearch(
            searchDb,
            "Bracket",
            undefined,
            undefined,
            true
        );
        expect(hits).toHaveLength(1);
        expect(hits[0].configuration).toBeUndefined();
    });
});
