import { env } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    type OnshapeConfigurationResponse,
    type OnshapeDocumentContents,
    type OnshapeElement,
    OnshapeElementType,
    OnshapeFolderEntryType
} from "../../lib/onshape/types";
import * as DocumentEndpoints from "../../lib/onshape/endpoints/documents";
import * as ConfigurationEndpoints from "../../lib/onshape/endpoints/configurations";
import * as PartsEndpoints from "../../lib/onshape/endpoints/parts";
import * as ThumbnailStore from "../thumbnails/store";
import { getDb } from "../../db/client";
import { groups, insertables } from "../../db/schema";
import { type BuildIssue, BuildIssueType } from "../build-checker/issues";
import {
    type StoredInsertable,
    findMovedInsertables,
    findRemovedInsertables,
    loadGroup,
    selectInsertablesToLoad
} from "./load-group";
import {
    LOAD_CONCURRENCY,
    type GroupTarget,
    type LoadContext,
    type LoadingGroup
} from "./context";
import * as WorkspaceEndpoints from "../../lib/onshape/endpoints/workspaces";
import { createLimiter } from "../../lib/limiter";
import * as LoadCommonModule from "./context";
import {
    FAKE_STEP,
    MOCK_ONSHAPE_API,
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    resetDb,
    seedGroup,
    seedInsertable,
    TEST_VERSION_CREATED_AT
} from "../../../__test_utils__";

const GROUP: LoadingGroup = {
    libraryId: TEST_LIBRARY_ID,
    groupId: "group-1",
    name: "Group",
    versionPath: {
        documentId: "doc-1",
        instanceId: "v-1",
        instanceType: "v"
    },
    versionCreatedAt: TEST_VERSION_CREATED_AT,
    thumbnailPath: {
        documentId: "doc-1",
        instanceId: "w-1",
        instanceType: "w"
    }
};

/** Runs the selection against the shared test group. */
function select(
    insertableTabs: OnshapeElement[],
    stored: StoredInsertable[],
    forceReload: boolean
) {
    return selectInsertablesToLoad(GROUP, insertableTabs, stored, forceReload);
}

/** An element that is in the document but never an insertable tab. */
function drawing(elementId: string): OnshapeElement {
    return {
        id: elementId,
        name: `Drawing ${elementId}`,
        elementType: OnshapeElementType.DRAWING,
        microversionId: "mv-1"
    };
}

function tab(elementId: string, microversionId = "mv-1"): OnshapeElement {
    return {
        id: elementId,
        name: `Tab ${elementId}`,
        elementType: OnshapeElementType.PART_STUDIO,
        microversionId
    };
}

function storedRow(
    elementId: string,
    buildIssues: BuildIssue[] = [],
    sortOrder = 0
): StoredInsertable {
    return {
        id: `row-${elementId}`,
        elementId,
        microversionId: "mv-1",
        buildIssues,
        sortOrder
    };
}

describe("selectInsertablesToLoad", () => {
    it("builds a target for a brand-new element, minting an id", () => {
        const toLoad = select([tab("e1")], [], false);
        expect(toLoad).toHaveLength(1);
        expect(toLoad[0]).toMatchObject({
            libraryId: GROUP.libraryId,
            groupId: GROUP.groupId,
            elementPath: {
                documentId: "doc-1",
                instanceId: "v-1",
                instanceType: "v",
                elementId: "e1"
            },
            name: "Tab e1",
            microversionId: "mv-1",
            sortOrder: 0
        });
        // A fresh id, not one carried over from a stored row.
        expect(toLoad[0].insertableId).not.toBe("row-e1");
    });

    it("leaves an unchanged element alone", () => {
        const toLoad = select([tab("e1")], [storedRow("e1")], false);
        expect(toLoad).toEqual([]);
    });

    it("reloads an element whose microversion changed, keeping its id", () => {
        const toLoad = select([tab("e1", "mv-2")], [storedRow("e1")], false);
        expect(toLoad).toHaveLength(1);
        expect(toLoad[0]).toMatchObject({
            insertableId: "row-e1",
            microversionId: "mv-2"
        });
    });

    // A failure writes no microversion, so the tab still looks unchanged.
    it("retries an unchanged element the last load failed on", () => {
        const toLoad = select(
            [tab("e1")],
            [storedRow("e1", [{ type: BuildIssueType.LOAD_FAILED }])],
            false
        );
        expect(toLoad).toHaveLength(1);
        expect(toLoad[0].insertableId).toBe("row-e1");
    });

    it("leaves an unchanged element with an unrelated issue alone", () => {
        const toLoad = select(
            [tab("e1")],
            [storedRow("e1", [{ type: BuildIssueType.NO_VENDORS }])],
            false
        );
        expect(toLoad).toEqual([]);
    });

    it("reloads unchanged elements on forceReload", () => {
        const toLoad = select([tab("e1")], [storedRow("e1")], true);
        expect(toLoad).toHaveLength(1);
        expect(toLoad[0].insertableId).toBe("row-e1");
    });

    it("seeds sortOrder from the tab position", () => {
        const toLoad = select([tab("e1"), tab("e2")], [], false);
        expect(
            toLoad.map((insertable) => [
                insertable.elementPath.elementId,
                insertable.sortOrder
            ])
        ).toEqual([
            ["e1", 0],
            ["e2", 1]
        ]);
    });
});

describe("findRemovedInsertables", () => {
    it("returns ids of stored rows whose element left the document", () => {
        const removedIds = findRemovedInsertables(
            [tab("e1")],
            [storedRow("e1"), storedRow("gone")]
        );
        expect(removedIds).toEqual(["row-gone"]);
    });

    it("is empty when every stored row still has its element", () => {
        const removedIds = findRemovedInsertables(
            [tab("e1")],
            [storedRow("e1")]
        );
        expect(removedIds).toEqual([]);
    });
});

describe("findMovedInsertables", () => {
    it("returns the new position of every row the tab order moved", () => {
        const moved = findMovedInsertables(
            [tab("e2"), tab("e1")],
            [storedRow("e1", [], 0), storedRow("e2", [], 1)]
        );
        expect(moved).toEqual([
            { insertableId: "row-e2", sortOrder: 0 },
            { insertableId: "row-e1", sortOrder: 1 }
        ]);
    });

    it("is empty when the stored rows already sit in tab order", () => {
        const moved = findMovedInsertables(
            [tab("e1"), tab("e2")],
            [storedRow("e1", [], 0), storedRow("e2", [], 1)]
        );
        expect(moved).toEqual([]);
    });

    it("names only stored rows the document still has a tab for", () => {
        const moved = findMovedInsertables(
            [tab("new"), tab("e1")],
            [storedRow("e1", [], 0), storedRow("gone", [], 1)]
        );
        expect(moved).toEqual([{ insertableId: "row-e1", sortOrder: 1 }]);
    });
});

const db = getDb(env.DB);

/** The version "v-2" was cut, which is the date the load should record. */
const LOADED_VERSION_CREATED_AT = new Date("2026-02-03T04:05:06Z");

/** The group seeds start at version "inst-1"; the load moves them to "v-2". */
const LOADED_TARGET: GroupTarget = {
    libraryId: TEST_LIBRARY_ID,
    groupId: TEST_GROUP_ID,
    name: "Reloaded Group",
    versionPath: {
        documentId: `doc-${TEST_GROUP_ID}`,
        instanceId: "v-2",
        instanceType: "v"
    },
    versionCreatedAt: LOADED_VERSION_CREATED_AT
};

const WORKSPACE = {
    id: "w-thumbnails",
    name: "FRCDesignApp Thumbnails (DO NOT EDIT)"
};

const CTX: LoadContext = {
    env,
    sessionId: "test-session",
    step: FAKE_STEP,
    limit: createLimiter(LOAD_CONCURRENCY),
    thumbnailLimit: createLimiter(LOAD_CONCURRENCY)
};

/** Serves the given tabs as the document's contents, all in one folder. */
function contentsOf(tabs: OnshapeElement[]): OnshapeDocumentContents {
    return {
        elements: tabs,
        folders: {
            btType: OnshapeFolderEntryType.GROUP,
            groups: tabs.map((element) => ({
                btType: OnshapeFolderEntryType.ELEMENT,
                elementId: element.id
            }))
        }
    };
}

function mockContents(tabs: OnshapeElement[]) {
    vi.spyOn(DocumentEndpoints, "getContents").mockResolvedValue(
        contentsOf(tabs)
    );
}

/** An element with no configuration parameters. */
const NO_CONFIGURATION: OnshapeConfigurationResponse = {
    btType: "BTConfigurationResponse-2019",
    configurationParameters: []
};

function readGroup() {
    return db.select().from(groups).where(eq(groups.id, TEST_GROUP_ID)).get();
}

describe("loadGroup", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db);
        // Onshape calls are mocked at the endpoint wrappers instead.
        vi.spyOn(
            LoadCommonModule,
            "getOnshapeApiFromContext"
        ).mockResolvedValue(MOCK_ONSHAPE_API);
        // Every part-studio load probes its parts for the open-composite flag.
        vi.spyOn(PartsEndpoints, "getParts").mockResolvedValue([]);
        vi.spyOn(WorkspaceEndpoints, "getWorkspaces").mockResolvedValue([]);
        vi.spyOn(WorkspaceEndpoints, "createWorkspace").mockResolvedValue(
            WORKSPACE
        );
        vi.spyOn(WorkspaceEndpoints, "restoreVersion").mockResolvedValue();
    });

    afterEach(() => vi.restoreAllMocks());

    it("saves the insertables and advances the group's version", async () => {
        mockContents([tab("e1"), tab("e2")]);
        vi.spyOn(ConfigurationEndpoints, "getConfiguration").mockResolvedValue(
            NO_CONFIGURATION
        );

        const result = await loadGroup(CTX, LOADED_TARGET, false);

        expect(result).toMatchObject({ loadedElements: 2, failedElements: 0 });
        const groupRow = await readGroup();
        expect(groupRow?.versionId).toBe("v-2");
        // Dates the version, not the sync.
        expect(groupRow?.versionCreatedAt).toEqual(LOADED_VERSION_CREATED_AT);
        expect(groupRow?.name).toBe("Reloaded Group");
        expect(groupRow?.lastLoadedAt).toEqual(expect.any(Date));
        expect(groupRow?.buildIssues).not.toContainEqual({
            type: BuildIssueType.INSERTABLES_FAILED
        });

        const rows = await db.select().from(insertables).all();
        expect(rows.map((row) => row.elementId).sort()).toEqual(["e1", "e2"]);
        for (const row of rows) {
            expect(row.versionCreatedAt).toEqual(LOADED_VERSION_CREATED_AT);
        }
    });

    it("reads every thumbnail from a workspace made off the version", async () => {
        mockContents([tab("e1"), tab("e2")]);
        vi.spyOn(ConfigurationEndpoints, "getConfiguration").mockResolvedValue(
            NO_CONFIGURATION
        );
        // An empty studio records NO_PARTS and never reaches the thumbnail.
        vi.spyOn(PartsEndpoints, "getParts").mockResolvedValue([
            { partId: "p1" }
        ]);
        const uploaded = vi
            .spyOn(ThumbnailStore, "uploadThumbnails")
            .mockResolvedValue({ small: "s", large: "l" });

        await loadGroup(CTX, LOADED_TARGET, false);

        expect(WorkspaceEndpoints.createWorkspace).toHaveBeenCalledWith(
            MOCK_ONSHAPE_API,
            LOADED_TARGET.versionPath,
            expect.objectContaining({ versionId: "v-2" })
        );
        for (const elementId of ["e1", "e2"]) {
            const call = uploaded.mock.calls.find(
                (args) => args[2].elementId === elementId
            );
            expect(call?.[2]).toEqual({
                documentId: `doc-${TEST_GROUP_ID}`,
                instanceId: WORKSPACE.id,
                instanceType: "w",
                elementId
            });
        }
        expect((await readGroup())?.thumbnailWorkspaceId).toBe(WORKSPACE.id);
    });

    it("restores a new version into the workspace, and deletes our others", async () => {
        mockContents([tab("e1")]);
        vi.spyOn(ConfigurationEndpoints, "getConfiguration").mockResolvedValue(
            NO_CONFIGURATION
        );
        vi.spyOn(WorkspaceEndpoints, "getWorkspaces").mockResolvedValue([
            { id: "main", name: "Main" },
            { ...WORKSPACE, id: "w-z-old" },
            // Only shares part of the name.
            { id: "w-lookalike", name: "FRCDesignApp Thumbnails" },
            WORKSPACE
        ]);
        const deleted = vi
            .spyOn(WorkspaceEndpoints, "deleteWorkspace")
            .mockResolvedValue();

        await loadGroup(CTX, LOADED_TARGET, false, {
            workspaceId: WORKSPACE.id,
            versionId: "v-1"
        });

        expect(WorkspaceEndpoints.createWorkspace).not.toHaveBeenCalled();
        expect(WorkspaceEndpoints.restoreVersion).toHaveBeenCalledWith(
            MOCK_ONSHAPE_API,
            expect.objectContaining({ instanceId: WORKSPACE.id }),
            "v-2"
        );
        expect(deleted.mock.calls.map((call) => call[2])).toEqual(["w-z-old"]);
        expect((await readGroup())?.thumbnailWorkspaceId).toBe(WORKSPACE.id);
    });

    // A forced reload of the same version would otherwise re-render everything.
    it("skips the restore when the workspace already holds the version", async () => {
        mockContents([tab("e1")]);
        vi.spyOn(ConfigurationEndpoints, "getConfiguration").mockResolvedValue(
            NO_CONFIGURATION
        );
        vi.spyOn(WorkspaceEndpoints, "getWorkspaces").mockResolvedValue([
            WORKSPACE
        ]);

        await loadGroup(CTX, LOADED_TARGET, true, {
            workspaceId: WORKSPACE.id,
            versionId: "v-2"
        });

        expect(WorkspaceEndpoints.restoreVersion).not.toHaveBeenCalled();
    });

    it("takes the group thumbnail from the designated element without re-reading the document", async () => {
        mockContents([tab("e1"), drawing("cover")]);
        vi.spyOn(ConfigurationEndpoints, "getConfiguration").mockResolvedValue(
            NO_CONFIGURATION
        );
        const document = vi.spyOn(DocumentEndpoints, "getDocument");
        const uploaded = vi
            .spyOn(ThumbnailStore, "uploadThumbnails")
            .mockResolvedValue({ small: "s", large: "l" });

        await loadGroup(
            CTX,
            { ...LOADED_TARGET, thumbnailElementId: "cover" },
            false
        );

        const groupCall = uploaded.mock.calls.find(
            (args) => args[2].elementId === "cover"
        );
        expect(groupCall?.[2]).toMatchObject({ instanceId: WORKSPACE.id });
        expect(document).not.toHaveBeenCalled();
    });

    // Its id is what inserts and document links are built from.
    it("advances a skipped insertable's version along with the group's", async () => {
        mockContents([tab("e1")]);
        // Same microversion as the tab, so the load skips it entirely.
        await seedInsertable(db, {
            id: "ins-e1",
            elementId: "e1",
            name: "Existing",
            microversionId: "mv-1",
            versionId: "inst-1"
        });
        const configurationSpy = vi.spyOn(
            ConfigurationEndpoints,
            "getConfiguration"
        );

        const result = await loadGroup(CTX, LOADED_TARGET, false);

        expect(result).toMatchObject({ loadedElements: 0 });
        // Nothing was reloaded...
        expect(configurationSpy).not.toHaveBeenCalled();
        const row = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, "ins-e1"))
            .get();
        expect(row?.versionId).toBe("v-2");
        expect((await readGroup())?.versionId).toBe("v-2");
    });

    // Moving a tab changes no microversion, so the load skips these rows.
    it("applies the document's tab order to insertables it did not reload", async () => {
        mockContents([tab("e2"), tab("e1")]);
        await seedInsertable(db, {
            id: "ins-e1",
            elementId: "e1",
            name: "First",
            microversionId: "mv-1",
            sortOrder: 0
        });
        await seedInsertable(db, {
            id: "ins-e2",
            elementId: "e2",
            name: "Second",
            microversionId: "mv-1",
            sortOrder: 1
        });
        const configurationSpy = vi.spyOn(
            ConfigurationEndpoints,
            "getConfiguration"
        );

        const result = await loadGroup(CTX, LOADED_TARGET, false);

        expect(result).toMatchObject({ loadedElements: 0 });
        expect(configurationSpy).not.toHaveBeenCalled();
        const rows = await db
            .select()
            .from(insertables)
            .orderBy(asc(insertables.sortOrder))
            .all();
        expect(rows.map((row) => row.elementId)).toEqual(["e2", "e1"]);
    });

    it("makes room in the tab order for a newly added tab", async () => {
        mockContents([tab("new"), tab("e1")]);
        await seedInsertable(db, {
            id: "ins-e1",
            elementId: "e1",
            name: "Existing",
            microversionId: "mv-1",
            sortOrder: 0
        });
        vi.spyOn(ConfigurationEndpoints, "getConfiguration").mockResolvedValue(
            NO_CONFIGURATION
        );

        await loadGroup(CTX, LOADED_TARGET, false);

        const rows = await db
            .select()
            .from(insertables)
            .orderBy(asc(insertables.sortOrder))
            .all();
        expect(rows.map((row) => row.elementId)).toEqual(["new", "e1"]);
        expect(rows.map((row) => row.sortOrder)).toEqual([0, 1]);
    });

    // The stale version brings the next reload back to retry it.
    it("holds the version back and flags the insertable that failed", async () => {
        mockContents([tab("e1"), tab("e2")]);
        vi.spyOn(ConfigurationEndpoints, "getConfiguration").mockImplementation(
            (_client, elementPath) =>
                elementPath.elementId === "e2"
                    ? Promise.reject(new Error("boom"))
                    : Promise.resolve(NO_CONFIGURATION)
        );

        const result = await loadGroup(CTX, LOADED_TARGET, false);

        expect(result).toMatchObject({ loadedElements: 1, failedElements: 1 });

        const groupRow = await readGroup();
        expect(groupRow?.versionId).toBe("inst-1");
        expect(groupRow?.buildIssues).toContainEqual({
            type: BuildIssueType.INSERTABLES_FAILED
        });

        // The insertable that loaded is saved; the one that failed never was.
        const rows = await db.select().from(insertables).all();
        expect(rows.map((row) => row.elementId)).toEqual(["e1"]);
    });

    it("adds LOAD_FAILED to a failed insertable's existing issues", async () => {
        mockContents([tab("e1", "mv-2")]);
        // A row from a previous good load, carrying an unrelated issue.
        await seedInsertable(db, {
            id: "ins-e1",
            elementId: "e1",
            name: "Existing",
            buildIssues: [{ type: BuildIssueType.NO_VENDORS }]
        });
        vi.spyOn(ConfigurationEndpoints, "getConfiguration").mockRejectedValue(
            new Error("boom")
        );

        await loadGroup(CTX, LOADED_TARGET, false);

        const row = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, "ins-e1"))
            .get();
        expect(row?.buildIssues).toEqual([
            { type: BuildIssueType.NO_VENDORS },
            { type: BuildIssueType.LOAD_FAILED }
        ]);
        // Untouched otherwise — the failed load never reached its save.
        expect(row?.name).toBe("Existing");
    });
});
