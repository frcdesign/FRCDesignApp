import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { configurations, insertables } from "../../shared/schema";
import { ConfigurationParameterType } from "../../shared/configuration-models";
import {
    ElementType,
    MateLocation,
    ThumbnailSize,
    ThumbnailUrls,
    Vendor
} from "../../shared/types";
import { BuildIssueType } from "../../shared/build-checker";
import {
    OnshapeDocumentContents,
    OnshapeElementType,
    OnshapeFolderEntryType
} from "../onshape-api/types/documents";
import { MOCK_ONSHAPE_API } from "../../__test_utils__/mock-onshape-api";
import {
    resetDb,
    seedGroup,
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    TEST_PARAMETERS
} from "../../__test_utils__";
import * as VersionsEndpoint from "../onshape-api/endpoints/versions";
import * as DocumentsEndpoint from "../onshape-api/endpoints/documents";
import * as ConfigurationsEndpoint from "../onshape-api/endpoints/configurations";
import * as InsertAndFasten from "./insert-and-fasten";
import {
    buildGroupValues,
    buildInsertableValues,
    fetchContents,
    fetchExistingInsertables,
    fetchVersion,
    getOrderedElementIds,
    getValidElements,
    loadElementConfiguration,
    loadElementFasten,
    matchElements,
    saveDocument,
    selectReloads,
    type DocumentElement,
    type DocumentInfo,
    type LoadedElement,
    type MatchedElement,
    type VersionInfo
} from "./load-document-steps";

const db = getDb(env.DB);

const THUMBS: ThumbnailUrls = {
    [ThumbnailSize.TINY]: "t",
    [ThumbnailSize.STANDARD]: "s"
};

const element = (
    elementId: string,
    microversionId = "mv-1"
): DocumentElement => ({
    elementId,
    name: elementId,
    elementType: ElementType.PART_STUDIO,
    microversionId
});

const matchedOf = (
    el: DocumentElement,
    overrides: Partial<MatchedElement> = {}
): MatchedElement => ({
    element: el,
    insertableId: `id-${el.elementId}`,
    isNew: false,
    storedMicroversionId: el.microversionId,
    supportsFasten: false,
    sortOrder: 0,
    ...overrides
});

const loadedOf = (
    matched: MatchedElement,
    overrides: Partial<LoadedElement> = {}
): LoadedElement => ({
    matched,
    fastenInfo: null,
    supportsFasten: false,
    vendors: [],
    configuration: null,
    thumbnailUrls: null,
    ...overrides
});

// --- pure: contents tree ----------------------------------------------------

describe("getValidElements / getOrderedElementIds", () => {
    const contents: OnshapeDocumentContents = {
        elements: [
            {
                id: "ps",
                name: "Part Studio",
                elementType: OnshapeElementType.PART_STUDIO,
                microversionId: "m1"
            },
            {
                id: "asm",
                name: "Assembly",
                elementType: OnshapeElementType.ASSEMBLY,
                microversionId: "m2"
            },
            {
                id: "dwg",
                name: "Drawing",
                elementType: OnshapeElementType.DRAWING,
                microversionId: "m3"
            }
        ],
        folders: {
            btType: OnshapeFolderEntryType.GROUP,
            groups: [
                { btType: OnshapeFolderEntryType.ELEMENT, elementId: "asm" },
                {
                    btType: OnshapeFolderEntryType.GROUP,
                    groups: [
                        {
                            btType: OnshapeFolderEntryType.ELEMENT,
                            elementId: "dwg"
                        },
                        {
                            btType: OnshapeFolderEntryType.ELEMENT,
                            elementId: "ps"
                        }
                    ]
                }
            ]
        }
    };

    it("keeps only part studios and assemblies", () => {
        expect(getValidElements(contents)).toEqual([
            {
                elementId: "ps",
                name: "Part Studio",
                elementType: ElementType.PART_STUDIO,
                microversionId: "m1"
            },
            {
                elementId: "asm",
                name: "Assembly",
                elementType: ElementType.ASSEMBLY,
                microversionId: "m2"
            }
        ]);
    });

    it("flattens the folder tree in order", () => {
        expect(getOrderedElementIds(contents)).toEqual(["asm", "dwg", "ps"]);
    });
});

// --- pure: match + select ---------------------------------------------------

describe("matchElements", () => {
    const docInfo: DocumentInfo = {
        docName: "Doc",
        elements: [element("e1", "mv-new"), element("e2")],
        orderedElementIds: ["e2", "e1"]
    };

    it("reuses existing rows and assigns ids + defaults to new elements", () => {
        const matched = matchElements(
            docInfo,
            [
                {
                    elementId: "e1",
                    insertableId: "keep-1",
                    microversionId: "mv-old",
                    supportsFasten: true
                }
            ],
            () => "fresh-uuid"
        );

        expect(matched).toEqual([
            {
                element: docInfo.elements[0],
                insertableId: "keep-1",
                isNew: false,
                storedMicroversionId: "mv-old",
                supportsFasten: true,
                sortOrder: 1
            },
            {
                element: docInfo.elements[1],
                insertableId: "fresh-uuid",
                isNew: true,
                storedMicroversionId: null,
                supportsFasten: false,
                sortOrder: 0
            }
        ]);
    });
});

describe("selectReloads", () => {
    const e = element("e1", "mv-cur");
    const unchanged = matchedOf(e, { storedMicroversionId: "mv-cur" });
    const changed = matchedOf(e, { storedMicroversionId: "mv-old" });
    const fresh = matchedOf(e, { isNew: true, storedMicroversionId: null });

    it("reloads new, changed, or forced elements only", () => {
        expect(selectReloads([unchanged, changed, fresh], false)).toEqual([
            changed,
            fresh
        ]);
    });

    it("reloads everything when forced", () => {
        expect(selectReloads([unchanged, changed, fresh], true)).toHaveLength(
            3
        );
    });
});

// --- pure: row builders -----------------------------------------------------

describe("buildInsertableValues", () => {
    const ctx = {
        groupId: "g1",
        documentId: "doc",
        libraryId: TEST_LIBRARY_ID,
        version: {
            instanceId: "v1",
            versionName: "V1",
            versionCreatedAt: "2020-01-01T00:00:00.000Z"
        } satisfies VersionInfo
    };

    it("maps the matched id/sortOrder and flags build issues", () => {
        const values = buildInsertableValues(
            loadedOf(
                matchedOf(element("e1"), { insertableId: "i1", sortOrder: 3 })
            ),
            ctx
        );
        expect(values).toMatchObject({
            id: "i1",
            elementId: "e1",
            groupId: "g1",
            sortOrder: 3,
            instanceId: "v1",
            vendors: [],
            thumbnailUrls: null
        });
        // No vendors and no thumbnail → both issues flagged.
        expect(values.buildIssues).toEqual([
            { type: BuildIssueType.THUMBNAIL_FAILED },
            { type: BuildIssueType.NO_VENDORS }
        ]);
    });

    it("is clean when vendors and thumbnails are present", () => {
        const values = buildInsertableValues(
            loadedOf(matchedOf(element("e1")), {
                vendors: [Vendor.WCP],
                thumbnailUrls: THUMBS
            }),
            ctx
        );
        expect(values.buildIssues).toEqual([]);
    });
});

describe("buildGroupValues", () => {
    it("flags NO_THUMBNAIL_TAB when there is no thumbnail element", () => {
        const values = buildGroupValues({
            groupId: "g1",
            documentId: "doc",
            libraryId: TEST_LIBRARY_ID,
            docInfo: { docName: "Doc", elements: [], orderedElementIds: [] },
            version: {
                instanceId: "v1",
                versionName: "V1",
                versionCreatedAt: "2020-01-01T00:00:00.000Z"
            },
            docThumbnailUrls: THUMBS
        });
        expect(values).toMatchObject({
            id: "g1",
            name: "Doc",
            instanceId: "v1"
        });
        expect(values.buildIssues).toEqual([
            { type: BuildIssueType.NO_THUMBNAIL_TAB }
        ]);
    });
});

// --- IO: mocked Onshape -----------------------------------------------------

describe("fetchVersion", () => {
    afterEach(() => vi.restoreAllMocks());

    it("maps id/name and normalizes createdAt to ISO", async () => {
        vi.spyOn(VersionsEndpoint, "getLatestVersion").mockResolvedValue({
            id: "v-9",
            name: "Rev 9",
            createdAt: "2021-06-01T12:00:00Z"
        });
        expect(await fetchVersion(MOCK_ONSHAPE_API, "doc")).toEqual({
            instanceId: "v-9",
            versionName: "Rev 9",
            versionCreatedAt: "2021-06-01T12:00:00.000Z"
        });
    });
});

describe("fetchContents", () => {
    afterEach(() => vi.restoreAllMocks());

    it("returns doc metadata + valid elements in order", async () => {
        vi.spyOn(DocumentsEndpoint, "getDocument").mockResolvedValue({
            name: "My Doc",
            documentThumbnailElementId: "thumb"
        });
        vi.spyOn(DocumentsEndpoint, "getContents").mockResolvedValue({
            elements: [
                {
                    id: "ps",
                    name: "PS",
                    elementType: OnshapeElementType.PART_STUDIO,
                    microversionId: "m1"
                }
            ],
            folders: {
                btType: OnshapeFolderEntryType.GROUP,
                groups: [
                    { btType: OnshapeFolderEntryType.ELEMENT, elementId: "ps" }
                ]
            }
        });

        expect(
            await fetchContents(MOCK_ONSHAPE_API, {
                documentId: "d",
                instanceId: "v",
                instanceType: "v"
            })
        ).toEqual({
            docName: "My Doc",
            thumbnailElementId: "thumb",
            elements: [
                {
                    elementId: "ps",
                    name: "PS",
                    elementType: ElementType.PART_STUDIO,
                    microversionId: "m1"
                }
            ],
            orderedElementIds: ["ps"]
        });
    });
});

describe("loadElementConfiguration", () => {
    const path = {
        documentId: "d",
        instanceId: "v",
        instanceType: "v" as const,
        elementId: "e"
    };
    afterEach(() => vi.restoreAllMocks());

    it("returns null when the element has no parameters", async () => {
        vi.spyOn(ConfigurationsEndpoint, "getConfiguration").mockResolvedValue({
            btType: "BTConfigurationResponse-2019",
            configurationParameters: []
        });
        expect(
            await loadElementConfiguration(MOCK_ONSHAPE_API, path, "Name")
        ).toBeNull();
    });

    it("parses parameters and derives vendors", async () => {
        vi.spyOn(ConfigurationsEndpoint, "getConfiguration").mockResolvedValue({
            btType: "BTConfigurationResponse-2019",
            configurationParameters: [
                {
                    btType: ConfigurationParameterType.BOOLEAN,
                    parameterId: "b",
                    parameterName: "B",
                    isCosmetic: false,
                    defaultValue: true,
                    visibilityCondition: {
                        btType: "BTParameterVisibilityCondition-177"
                    }
                }
            ]
        });
        const result = await loadElementConfiguration(
            MOCK_ONSHAPE_API,
            path,
            "Name"
        );
        expect(result?.parameters).toHaveLength(1);
        expect(Array.isArray(result?.vendors)).toBe(true);
    });
});

describe("loadElementFasten", () => {
    const path = {
        documentId: "d",
        instanceId: "v",
        instanceType: "v" as const,
        elementId: "e"
    };
    afterEach(() => vi.restoreAllMocks());

    it("skips parsing when the element does not support fasten", async () => {
        const spy = vi.spyOn(InsertAndFasten, "parseFastenInfo");
        expect(
            await loadElementFasten(
                MOCK_ONSHAPE_API,
                path,
                ElementType.PART_STUDIO,
                false
            )
        ).toEqual({ fastenInfo: null, supportsFasten: false });
        expect(spy).not.toHaveBeenCalled();
    });

    it("stringifies parsed fasten info on success", async () => {
        const info = {
            mateConnectorId: "mc",
            mateLocation: MateLocation.Feature,
            path: []
        };
        vi.spyOn(InsertAndFasten, "parseFastenInfo").mockResolvedValue(info);
        expect(
            await loadElementFasten(
                MOCK_ONSHAPE_API,
                path,
                ElementType.PART_STUDIO,
                true
            )
        ).toEqual({ fastenInfo: JSON.stringify(info), supportsFasten: true });
    });

    it("clears support when parsing throws", async () => {
        vi.spyOn(InsertAndFasten, "parseFastenInfo").mockRejectedValue(
            new Error("no mate connector")
        );
        expect(
            await loadElementFasten(
                MOCK_ONSHAPE_API,
                path,
                ElementType.PART_STUDIO,
                true
            )
        ).toEqual({ fastenInfo: null, supportsFasten: false });
    });
});

// --- IO: real D1 ------------------------------------------------------------

describe("fetchExistingInsertables", () => {
    beforeEach(() => resetDb(db));

    it("returns the match fields for a group's insertables", async () => {
        await seedGroup(db);
        await db.insert(insertables).values({
            id: "ins-1",
            groupId: TEST_GROUP_ID,
            libraryId: TEST_LIBRARY_ID,
            elementId: "e1",
            documentId: "doc",
            instanceId: "v1",
            elementType: ElementType.PART_STUDIO,
            name: "E1",
            microversionId: "mv-1",
            versionName: "v1",
            versionCreatedAt: new Date(0).toISOString(),
            supportsFasten: true
        });

        expect(await fetchExistingInsertables(db, TEST_GROUP_ID)).toEqual([
            {
                elementId: "e1",
                insertableId: "ins-1",
                microversionId: "mv-1",
                supportsFasten: true
            }
        ]);
    });
});

describe("saveDocument", () => {
    beforeEach(() => resetDb(db));

    const insertExisting = (
        id: string,
        elementId: string,
        extra: Partial<typeof insertables.$inferInsert> = {}
    ) =>
        db.insert(insertables).values({
            id,
            groupId: TEST_GROUP_ID,
            libraryId: TEST_LIBRARY_ID,
            elementId,
            documentId: "doc-test-group",
            instanceId: "inst-1",
            elementType: ElementType.PART_STUDIO,
            name: elementId,
            microversionId: "mv-old",
            versionName: "v1",
            versionCreatedAt: new Date(0).toISOString(),
            ...extra
        });

    it("upserts loaded elements, reuses ids, preserves user columns, deletes stale", async () => {
        await seedGroup(db);
        await insertExisting("keep-id", "e1", {
            isVisible: false,
            sortOrder: 5
        });
        await insertExisting("stale-id", "gone");

        const e1 = element("e1", "mv-2");
        const e2 = element("e2", "mv-2");
        const docInfo: DocumentInfo = {
            docName: "Doc",
            elements: [e1, e2],
            orderedElementIds: ["e1", "e2"]
        };

        await saveDocument(db, {
            groupId: TEST_GROUP_ID,
            documentId: "doc-test-group",
            libraryId: TEST_LIBRARY_ID,
            version: {
                instanceId: "inst-2",
                versionName: "v2",
                versionCreatedAt: new Date(1).toISOString()
            },
            docInfo,
            docThumbnailUrls: THUMBS,
            loaded: [
                loadedOf(
                    matchedOf(e1, { insertableId: "keep-id", sortOrder: 0 }),
                    { vendors: [Vendor.WCP], configuration: TEST_PARAMETERS }
                ),
                loadedOf(
                    matchedOf(e2, {
                        insertableId: "new-id",
                        isNew: true,
                        storedMicroversionId: null,
                        sortOrder: 1
                    })
                )
            ]
        });

        const rows = await db
            .select()
            .from(insertables)
            .where(eq(insertables.groupId, TEST_GROUP_ID))
            .all();
        const byElement = new Map(rows.map((r) => [r.elementId, r]));

        expect(rows).toHaveLength(2);
        expect(byElement.has("gone")).toBe(false); // stale deleted

        const kept = byElement.get("e1")!;
        expect(kept.id).toBe("keep-id"); // id reused
        expect(kept.isVisible).toBe(false); // user column preserved
        expect(kept.sortOrder).toBe(5); // sortOrder preserved on update
        expect(kept.microversionId).toBe("mv-2"); // synced fields updated
        expect(kept.vendors).toEqual([Vendor.WCP]);

        const added = byElement.get("e2")!;
        expect(added.id).toBe("new-id");
        expect(added.sortOrder).toBe(1); // new row uses matched sortOrder

        const configRows = await db
            .select()
            .from(configurations)
            .where(eq(configurations.id, "keep-id"))
            .all();
        expect(configRows[0]?.parameters).toEqual(TEST_PARAMETERS);
    });
});
