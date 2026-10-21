import { env } from "cloudflare:workers";
import {
    introspectWorkflowInstance,
    type WorkflowInstanceModifier
} from "cloudflare:test";
import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db/client";
import { groups, libraries, PLACEHOLDER_VERSION_ID } from "../../db/schema";
import {
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    resetDb,
    seedGroup
} from "../../../__test_utils__";
import { createShellGroup, type ShellGroup } from "./workflows";
import { flagFailedLoads } from "./flag";
import { APPROVE_EVENT, getJobStatus, type ReloadParams } from "./jobs";
import * as Context from "./context";
import * as LoadGroup from "./load-group";
import * as LibraryDb from "../library/db";
import * as Registration from "../webhooks/registration";
import * as DocumentEndpoints from "../../lib/onshape/endpoints/documents";
import * as VersionEndpoints from "../../lib/onshape/endpoints/versions";
import type { OAuthApi } from "../../lib/onshape/client";
import { BuildIssueType } from "../build-checker/issues";

const db = getDb(env.DB);

const PARAMS: ShellGroup = {
    groupId: "new-group",
    documentId: "doc-new",
    documentName: "New Doc",
    libraryId: TEST_LIBRARY_ID
};

function readVersion(): Promise<number | undefined> {
    return db
        .select({ cacheVersion: libraries.cacheVersion })
        .from(libraries)
        .where(eq(libraries.id, TEST_LIBRARY_ID))
        .get()
        .then((row) => row?.cacheVersion);
}

describe("createShellGroup", () => {
    beforeEach(() => resetDb(db));

    it("writes the group as unloaded, after the selected one", async () => {
        // Seeding a group creates the library, so there is a version to move.
        await seedGroup(db);

        await createShellGroup(env, {
            ...PARAMS,
            selectedGroupId: TEST_GROUP_ID
        });

        const rows = await db
            .select()
            .from(groups)
            .orderBy(asc(groups.sortOrder))
            .all();
        expect(rows.map((row) => row.id)).toEqual([
            TEST_GROUP_ID,
            PARAMS.groupId
        ]);
        const shell = rows[1];
        expect(shell.name).toBe(PARAMS.documentName);
        expect(shell.versionId).toBe(PLACEHOLDER_VERSION_ID);
        expect(shell.lastLoadedAt).toBeNull();
        // So a load that never starts still shows.
        expect(shell.buildIssues).toEqual([
            { type: BuildIssueType.NOT_LOADED }
        ]);
    });

    // Library responses are pinned to the version, so without a bump the group
    // is unreachable until the load finishes.
    it("bumps the library version, so the group is reachable", async () => {
        await seedGroup(db);
        const startVersion = await readVersion();

        await createShellGroup(env, PARAMS);

        expect(await readVersion()).toBeGreaterThan(startVersion ?? 0);
    });

    it("swaps not loaded for failed when its load fails", async () => {
        await seedGroup(db);
        await createShellGroup(env, PARAMS);

        await flagFailedLoads(env, [PARAMS.groupId]);

        const shell = await db
            .select()
            .from(groups)
            .where(eq(groups.id, PARAMS.groupId))
            .get();
        expect(shell?.buildIssues).toEqual([
            { type: BuildIssueType.LOAD_FAILED }
        ]);
    });
});

const RELOAD: ReloadParams = {
    libraryId: TEST_LIBRARY_ID,
    groupIds: ["a", "b"],
    forceReload: false,
    held: false
};

/** Runs a reload to its end. */
async function runReload(
    id: string,
    params: ReloadParams,
    modify: (m: WorkflowInstanceModifier) => Promise<void> = () =>
        Promise.resolve()
): Promise<void> {
    await using instance = await introspectWorkflowInstance(
        env.RELOAD_LIBRARY_WORKFLOW,
        id
    );
    await instance.modify(async (m) => {
        await m.disableSleeps();
        await modify(m);
    });
    await env.RELOAD_LIBRARY_WORKFLOW.create({ id, params });
    await instance.waitForStatus("complete");
}

describe("ReloadLibraryWorkflow", () => {
    let loaded: string[];

    beforeEach(async () => {
        await resetDb(db);
        const { keys } = await env.KV.list();
        await Promise.all(keys.map((key) => env.KV.delete(key.name)));
        await seedGroup(db, "a");
        await seedGroup(db, "b");
        loaded = [];
        vi.spyOn(Context, "getOnshapeApiFromContext").mockResolvedValue(
            {} as OAuthApi
        );
        vi.spyOn(DocumentEndpoints, "getDocument").mockImplementation(
            (_client, { documentId }) =>
                Promise.resolve({
                    id: documentId,
                    name: documentId,
                    defaultWorkspace: { id: "w" }
                })
        );
        vi.spyOn(VersionEndpoints, "getLatestVersion").mockResolvedValue({
            id: "new-version",
            name: "V2",
            createdAt: new Date().toISOString()
        });
        vi.spyOn(LoadGroup, "loadGroup").mockImplementation((_ctx, target) => {
            loaded.push(target.groupId);
            return Promise.resolve({
                loadedElements: 1,
                deletedElements: 0,
                failedElements: 0
            });
        });
        vi.spyOn(Registration, "ensureWebhook").mockResolvedValue();
    });
    afterEach(() => vi.restoreAllMocks());

    it("loads every group under one claim, and rebuilds search once", async () => {
        const rebuild = vi.spyOn(LibraryDb, "rebuildSearchDb");

        await runReload("whole", RELOAD);

        expect(loaded.sort()).toEqual(["a", "b"]);
        expect(rebuild).toHaveBeenCalledOnce();
        expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
            loadingGroupIds: [],
            awaitingApprovalGroupIds: []
        });
    });

    it("loads a held version once it is approved", async () => {
        await runReload("approved", { ...RELOAD, held: true }, (m) =>
            m.mockEvent({ type: APPROVE_EVENT, payload: {} })
        );
        expect(loaded.sort()).toEqual(["a", "b"]);
    });

    it("loads a held version anyway once nobody approves it", async () => {
        await runReload("unapproved", { ...RELOAD, held: true }, (m) =>
            m.forceEventTimeout({ name: "approval" })
        );
        expect(loaded.sort()).toEqual(["a", "b"]);
    });

    it("waits its turn behind a reload already holding the library", async () => {
        // The holder finishes after this reload has asked twice.
        let asked = 0;
        const get = env.RELOAD_LIBRARY_WORKFLOW.get.bind(
            env.RELOAD_LIBRARY_WORKFLOW
        );
        vi.spyOn(env.RELOAD_LIBRARY_WORKFLOW, "get").mockImplementation((id) =>
            id === "holder"
                ? Promise.resolve({
                      status: () =>
                          Promise.resolve({
                              status: ++asked > 2 ? "complete" : "running"
                          })
                  } as never)
                : get(id)
        );
        await env.KV.put(
            `library-reload:${TEST_LIBRARY_ID}`,
            JSON.stringify({
                instanceId: "holder",
                startedAt: Date.now(),
                loadingGroupIds: []
            })
        );

        await runReload("waiting", { ...RELOAD, groupIds: ["a"] });

        expect(asked).toBeGreaterThan(2);
        expect(loaded).toEqual(["a"]);
    });
});
