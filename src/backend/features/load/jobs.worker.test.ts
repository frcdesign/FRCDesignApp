import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { TEST_LIBRARY_ID, resetDb, seedGroup } from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { BuildIssueType } from "../build-checker/issues";
import * as LibraryDb from "../library/db";
import {
    claimLibrary,
    finishReload,
    getJobStatus,
    reportProgress,
    requestReload,
    type ReloadParams
} from "./jobs";

const db = getDb(env.DB);

function params(groupIds: string[]): ReloadParams {
    return {
        libraryId: TEST_LIBRARY_ID,
        groupIds,
        sessionId: "session",
        forceReload: false
    };
}

/** Which reloads Workflows reports running; the rest have ended. */
function running(...instanceIds: string[]) {
    vi.spyOn(env.RELOAD_LIBRARY_WORKFLOW, "get").mockImplementation((id) =>
        Promise.resolve({
            status: () =>
                Promise.resolve({
                    status: instanceIds.includes(id) ? "running" : "complete"
                })
        } as never)
    );
}

/** Lets `requestReload` start a reload without running it. */
function stubCreate() {
    return vi
        .spyOn(env.RELOAD_LIBRARY_WORKFLOW, "create")
        .mockResolvedValue({} as never);
}

async function clearKv() {
    const { keys } = await env.KV.list();
    await Promise.all(keys.map((key) => env.KV.delete(key.name)));
}

const issuesOf = async (groupId: string) =>
    (await db.select().from(groups).where(eq(groups.id, groupId)).get())
        ?.buildIssues;

describe("library reloads", () => {
    beforeEach(async () => {
        await resetDb(db);
        await clearKv();
        await seedGroup(db, "a");
        await seedGroup(db, "b");
    });
    afterEach(() => vi.restoreAllMocks());

    it("shows the groups loading as soon as the reload is asked for", async () => {
        const create = stubCreate();

        await requestReload(env, params(["a", "b"]));

        expect(create).toHaveBeenCalledWith({
            id: expect.any(String),
            params: params(["a", "b"])
        });
        expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
            loadingGroupIds: ["a", "b"]
        });
    });

    it("lets one reload hold a library while it runs", async () => {
        running("first");
        expect(await claimLibrary(env, params(["a"]), "first")).toBeDefined();
        expect(
            await claimLibrary(env, params(["b"]), "second")
        ).toBeUndefined();
    });

    it("takes over from a reload that died, failing what it hadn't finished", async () => {
        running("second");
        const dead = await claimLibrary(env, params(["a", "b"]), "first");
        await reportProgress(env, TEST_LIBRARY_ID, {
            ...dead!,
            loadingGroupIds: ["b"]
        });

        expect(await claimLibrary(env, params(["a"]), "second")).toBeDefined();

        expect(await issuesOf("a")).toEqual([]);
        expect(await issuesOf("b")).toEqual([
            { type: BuildIssueType.LOAD_FAILED }
        ]);
    });

    it("counts down the groups as the reload finishes them", async () => {
        running("first");
        const claim = await claimLibrary(env, params(["a", "b"]), "first");
        await reportProgress(env, TEST_LIBRARY_ID, {
            ...claim!,
            loadingGroupIds: ["b"]
        });

        expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
            loadingGroupIds: ["b"]
        });
    });

    it("rebuilds search once it wrote, and frees the library", async () => {
        running("first", "second");
        const rebuild = vi.spyOn(LibraryDb, "rebuildSearchDb");
        await claimLibrary(env, params(["a"]), "first");

        await finishReload(env, TEST_LIBRARY_ID, "first", true);

        expect(rebuild).toHaveBeenCalledOnce();
        expect(await claimLibrary(env, params(["b"]), "second")).toBeDefined();
    });

    it("leaves search alone when nothing changed", async () => {
        const rebuild = vi.spyOn(LibraryDb, "rebuildSearchDb");
        await finishReload(env, TEST_LIBRARY_ID, "first", false);
        expect(rebuild).not.toHaveBeenCalled();
    });

    it("never frees a library another reload took", async () => {
        running("first", "second");
        await claimLibrary(env, params(["a"]), "second");

        await finishReload(env, TEST_LIBRARY_ID, "first", false);

        expect(await claimLibrary(env, params(["b"]), "third")).toBeUndefined();
    });

    describe("status", () => {
        it("drops a waiting reload that has since ended", async () => {
            stubCreate();
            await requestReload(env, params(["a"]));
            running();

            expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
                loadingGroupIds: []
            });
        });

        it("keeps a reload Workflows can't be asked about", async () => {
            stubCreate();
            await requestReload(env, params(["a"]));
            vi.spyOn(env.RELOAD_LIBRARY_WORKFLOW, "get").mockRejectedValue(
                new Error("unavailable")
            );
            vi.spyOn(console, "warn").mockImplementation(() => undefined);

            expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
                loadingGroupIds: ["a"]
            });
        });

        it("leaves no mark when the reload can't be started", async () => {
            vi.spyOn(env.RELOAD_LIBRARY_WORKFLOW, "create").mockRejectedValue(
                new Error("down")
            );

            await expect(requestReload(env, params(["a"]))).rejects.toThrow();

            expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
                loadingGroupIds: []
            });
        });

        it("fails the groups a dead holder hadn't finished", async () => {
            running("first");
            await claimLibrary(env, params(["a"]), "first");
            running();

            expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
                loadingGroupIds: []
            });
            expect(await issuesOf("a")).toEqual([
                { type: BuildIssueType.LOAD_FAILED }
            ]);
        });
    });
});
