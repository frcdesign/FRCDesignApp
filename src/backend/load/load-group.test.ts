import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    type OnshapeConfigurationResponse,
    type OnshapeElement,
    OnshapeElementType,
    OnshapeFolderEntryType
} from "../onshape-api/onshape-types";
import * as DocumentEndpoints from "../onshape-api/endpoints/documents";
import * as ConfigurationEndpoints from "../onshape-api/endpoints/configurations";
import { getDb } from "../db";
import { ElementType } from "../../shared/types";
import { group, insertables } from "../../shared/schema";
import { BuildIssueType } from "../../shared/build-checker";
import {
    type StoredInsertable,
    findRemovedInsertables,
    loadGroup,
    selectInsertablesToLoad
} from "./load-group";
import type { GroupTarget, LoadContext } from "./load-context";
import * as LoadContextModule from "./load-context";
import {
    FAKE_STEP,
    MOCK_ONSHAPE_API,
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    resetDb,
    seedGroup
} from "../../__test_utils__";

const GROUP: GroupTarget = {
    libraryId: TEST_LIBRARY_ID,
    groupId: "group-1",
    name: "Group",
    versionPath: {
        documentId: "doc-1",
        instanceId: "v-1",
        instanceType: "v"
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

function tab(elementId: string, microversionId = "mv-1"): OnshapeElement {
    return {
        id: elementId,
        name: `Tab ${elementId}`,
        elementType: OnshapeElementType.PART_STUDIO,
        microversionId
    };
}

function storedRow(elementId: string): StoredInsertable {
    return { id: `row-${elementId}`, elementId, microversionId: "mv-1" };
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

const db = getDb(env.DB);

/** The group seeds start at version "inst-1"; the load moves them to "v-2". */
const LOADED_TARGET: GroupTarget = {
    libraryId: TEST_LIBRARY_ID,
    groupId: TEST_GROUP_ID,
    name: "Reloaded Group",
    versionPath: {
        documentId: `doc-${TEST_GROUP_ID}`,
        instanceId: "v-2",
        instanceType: "v"
    }
};

const CTX: LoadContext = {
    env,
    sessionId: "test-session",
    step: FAKE_STEP
};

/** Serves the given tabs as the document's contents, all in one folder. */
function mockContents(tabs: OnshapeElement[]) {
    vi.spyOn(DocumentEndpoints, "getContents").mockResolvedValue({
        elements: tabs,
        folders: {
            btType: OnshapeFolderEntryType.GROUP,
            groups: tabs.map((element) => ({
                btType: OnshapeFolderEntryType.ELEMENT,
                elementId: element.id
            }))
        }
    });
}

/** An element with no configuration parameters. */
const NO_CONFIGURATION: OnshapeConfigurationResponse = {
    btType: "BTConfigurationResponse-2019",
    configurationParameters: []
};

function readGroup() {
    return db.select().from(group).where(eq(group.id, TEST_GROUP_ID)).get();
}

describe("loadGroup", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db);
        // The real one reads OAuth tokens out of KV; every Onshape call these
        // tests reach is mocked at the endpoint wrapper instead.
        vi.spyOn(
            LoadContextModule,
            "getOnshapeApiFromContext"
        ).mockResolvedValue(MOCK_ONSHAPE_API);
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
        expect(groupRow?.name).toBe("Reloaded Group");
        expect(groupRow?.buildIssues).not.toContainEqual({
            type: BuildIssueType.INSERTABLES_FAILED
        });

        const rows = await db.select().from(insertables).all();
        expect(rows.map((row) => row.elementId).sort()).toEqual(["e1", "e2"]);
    });

    // The version is what makes a failure self-healing: leaving it stale is what
    // brings the next reload back to retry only the insertable that failed.
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
        await db.insert(insertables).values({
            id: "ins-e1",
            groupId: TEST_GROUP_ID,
            libraryId: TEST_LIBRARY_ID,
            elementId: "e1",
            documentId: `doc-${TEST_GROUP_ID}`,
            versionId: "v-1",
            elementType: ElementType.PART_STUDIO,
            name: "Existing",
            microversionId: "mv-1",
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
