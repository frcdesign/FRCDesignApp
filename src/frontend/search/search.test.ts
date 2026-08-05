import { describe, expect, it } from "vitest";
import { buildSearchDb, processTerm, tokenize } from "../../shared/search";
import { doSearch } from "./search";
import { LibraryOut } from "../../shared/api-models";
import { ElementType, ThumbnailUrls } from "../../shared/types";
import {
    ConfigurationRecord,
    ParameterValues
} from "../../shared/configuration-models";

/** Builds a configuration record carrying just a part number + configuration. */
function record(
    partNumber: string,
    configuration: ParameterValues
): ConfigurationRecord {
    return {
        configuration,
        partNumber,
        name: null,
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

    it("does not attach a configuration for a name match", () => {
        const searchDb = buildSearchDb(library(), recordsMap);
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
