import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { TEST_LIBRARY_ID, resetDb, seedGroup } from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { BuildIssueType } from "../build-checker/issues";
import * as LibraryDb from "../library/db";
import {
    APPROVE_EVENT,
    approveHeldReloads,
    claimLibrary,
    finishReload,
    getJobStatus,
    releaseHold,
    reportProgress,
    requestReload,
    type ReloadParams
} from "./jobs";

const db = getDb(env.DB);

function params(groupIds: string[], held = false): ReloadParams {
    return {
        libraryId: TEST_LIBRARY_ID,
        groupIds,
        sessionId: "session",
        forceReload: false,
        held
    };
}

/** Which reloads Workflows reports running; the rest have ended. */
function running(...instanceIds: string[]) {
    const sendEvent = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(env.RELOAD_LIBRARY_WORKFLOW, "get").mockImplementation((id) =>
        Promise.resolve({
            status: () =>
                Promise.resolve({
                    status: instanceIds.includes(id) ? "running" : "complete"
                }),
            sendEvent
        } as never)
    );
    return { sendEvent };
}

/** The ids `requestReload` gave the reloads it started, in order. */
function stubCreate() {
    return vi
        .spyOn(env.RELOAD_LIBRARY_WORKFLOW, "create")
        .mockResolvedValue({} as never);
}

const createdIds = (create: ReturnType<typeof stubCreate>) =>
    create.mock.calls.map((call) => call[0]?.id ?? "");

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
            loadingGroupIds: ["a", "b"],
            awaitingApprovalGroupIds: []
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
            loadingGroupIds: ["b"],
            awaitingApprovalGroupIds: []
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

    describe("held versions", () => {
        it("lists a held reload as awaiting approval", async () => {
            stubCreate();
            await requestReload(env, params(["a"], true));

            expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
                loadingGroupIds: [],
                awaitingApprovalGroupIds: ["a"]
            });
        });

        it("approves every held reload, counting its groups", async () => {
            const create = stubCreate();
            await requestReload(env, params(["a"], true));
            await requestReload(env, params(["a", "b"], true));
            await requestReload(env, params(["b"]));
            const { sendEvent } = running(...createdIds(create));

            expect(await approveHeldReloads(env, TEST_LIBRARY_ID)).toBe(2);
            expect(sendEvent).toHaveBeenCalledTimes(2);
            expect(sendEvent).toHaveBeenCalledWith({
                type: APPROVE_EVENT,
                payload: {}
            });
        });

        it("loads once released, waiting its turn", async () => {
            const create = stubCreate();
            await requestReload(env, params(["a"], true));
            const [id] = createdIds(create);
            running(id);

            await releaseHold(env, params(["a"], true), id);

            expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
                loadingGroupIds: ["a"],
                awaitingApprovalGroupIds: []
            });
        });
    });

    describe("status", () => {
        it("drops a waiting reload that has since ended", async () => {
            stubCreate();
            vi.useFakeTimers({ toFake: ["Date"] });
            await requestReload(env, params(["a"]));
            vi.setSystemTime(Date.now() + 5 * 60_000);
            running();

            expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
                loadingGroupIds: [],
                awaitingApprovalGroupIds: []
            });
            vi.useRealTimers();
        });

        // Its mark is written before Workflows has the reload.
        it("keeps a reload asked for a moment ago", async () => {
            stubCreate();
            await requestReload(env, params(["a"]));
            running();

            expect(
                (await getJobStatus(env, TEST_LIBRARY_ID)).loadingGroupIds
            ).toEqual(["a"]);
        });

        it("fails the groups a dead holder hadn't finished", async () => {
            running("first");
            await claimLibrary(env, params(["a"]), "first");
            running();

            expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
                loadingGroupIds: [],
                awaitingApprovalGroupIds: []
            });
            expect(await issuesOf("a")).toEqual([
                { type: BuildIssueType.LOAD_FAILED }
            ]);
        });
    });
});
