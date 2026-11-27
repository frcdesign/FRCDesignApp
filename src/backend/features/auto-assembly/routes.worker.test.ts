import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as FastenerSets from "./fastener-set";
import { FASTENER_SET } from "../../../__test_utils__/fastener-set";
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import {
    ASSEMBLY,
    BODY,
    mockAssemblyReads,
    workspaceElements
} from "../../../__test_utils__/auto-assembly-fixtures";
import { Program } from "./catalog";
import {
    AssemblyJobState,
    AssemblyRunKind,
    AssemblyTaskAction,
    AssemblyTaskState,
    HoleStatus,
    type AssemblyJobStatus,
    type PickCheckOut,
    ProblemSeverity,
    SelectedEntityType,
    SelectionMode,
    StopCondition
} from "./contract";
import { reportJob } from "./jobs";
import * as IndexHoles from "./index-holes";

const app = createTestApp();

/** Under a session, which the run borrows. */
function post(path: string, body: unknown) {
    return app.request(
        `/api${path}`,
        {
            ...jsonRequest("POST", body),
            headers: {
                "Content-Type": "application/json",
                Cookie: "__Host-frc-design-app-session=session"
            }
        },
        env
    );
}

function publish() {
    vi.spyOn(FastenerSets, "getFastenerSet").mockResolvedValue(FASTENER_SET);
}

beforeEach(async () => {
    for (const key of (await env.KV.list({ prefix: "assembly-job" })).keys) {
        await env.KV.delete(key.name);
    }
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("POST /api/auto-assembly/insert", () => {
    it("starts a run, and marks it going with every step to come", async () => {
        publish();
        const create = vi
            .spyOn(env.AUTO_ASSEMBLY_WORKFLOW, "create")
            .mockResolvedValue({ id: "run-1" } as WorkflowInstance);
        vi.spyOn(env.AUTO_ASSEMBLY_WORKFLOW, "get").mockResolvedValue({
            status: () => Promise.resolve({ status: "running" })
        } as unknown as WorkflowInstance);

        const res = await post("/auto-assembly/insert", BODY);
        expect(res.status).toBe(200);
        expect(create.mock.calls[0][0]?.params?.request).toMatchObject({
            assembly: ASSEMBLY,
            selectionMode: SelectionMode.LOCATIONS
        });

        const job = await app.request(
            "/api/auto-assembly/job?documentId=doc&instanceId=ws&elementId=asm",
            {},
            env
        );
        const status = await job.json<AssemblyJobStatus>();
        expect(status.state).toBe(AssemblyJobState.RUNNING);
        expect(status.tasks?.map((task) => task.state)).toEqual([
            AssemblyTaskState.PENDING,
            AssemblyTaskState.PENDING,
            AssemblyTaskState.PENDING,
            AssemblyTaskState.PENDING
        ]);
    });

    it("says so until the parts are published", async () => {
        expect((await post("/auto-assembly/insert", BODY)).status).toBe(503);
    });

    it("refuses a second run in an assembly while one goes", async () => {
        publish();
        await reportJob(env, ASSEMBLY, {
            state: AssemblyJobState.RUNNING,
            jobId: "running"
        });
        vi.spyOn(env.AUTO_ASSEMBLY_WORKFLOW, "get").mockResolvedValue({
            status: () => Promise.resolve({ status: "running" })
        } as unknown as WorkflowInstance);
        expect((await post("/auto-assembly/insert", BODY)).status).toBe(409);
    });

    it("refuses FTC, whose fasteners aren't in yet", async () => {
        const res = await post("/auto-assembly/insert", {
            ...BODY,
            options: { ...BODY.options, program: Program.FTC }
        });
        expect(res.status).toBe(400);
    });

    it("refuses a part its vendor doesn't make, or a nut washer without a nut", async () => {
        publish();
        const insert = (options: object) =>
            post("/auto-assembly/insert", {
                ...BODY,
                options: { ...BODY.options, ...options }
            });
        // REV makes no nuts, and a nut is in the screw's size
        expect(
            (
                await insert({
                    nut: { vendor: "REV", size: "NO_10_32", type: "NYLOCK" }
                })
            ).status
        ).toBe(400);
        expect(
            (
                await insert({
                    nut: { vendor: "MCMASTER", size: "NO_8_32", type: "NYLOCK" }
                })
            ).status
        ).toBe(400);
        expect(
            (
                await insert({
                    nut: undefined,
                    nutWasher: {
                        vendor: "GENERIC",
                        size: "NO_10_32",
                        type: "OD_1_2_X_0_049"
                    }
                })
            ).status
        ).toBe(400);
    });

    it("takes faces with edges to skip, or edges alone", async () => {
        publish();
        const face = {
            ...BODY.targets[0],
            entityType: SelectedEntityType.FACE
        };
        // A face picked as a location, and an edge skipped among locations
        expect(
            (await post("/auto-assembly/insert", { ...BODY, targets: [face] }))
                .status
        ).toBe(400);
        expect(
            (
                await post("/auto-assembly/insert", {
                    ...BODY,
                    excluded: BODY.targets
                })
            ).status
        ).toBe(400);
    });

    it("flips only circular edges that are picked", async () => {
        publish();
        const res = await post("/auto-assembly/insert", {
            ...BODY,
            flipped: [{ ...BODY.targets[0], entityId: "JHZ" }]
        });
        expect(res.status).toBe(400);
        expect(JSON.stringify(await res.json())).toContain(
            "Flip only circular edges that are picked."
        );
    });

    it("takes a face to stop at only with the Face stop condition", async () => {
        publish();
        const stopFace = {
            ...BODY.targets[0],
            entityType: SelectedEntityType.FACE
        };
        const atFace = { ...BODY.options, stop: StopCondition.FACE };
        const missing = await post("/auto-assembly/insert", {
            ...BODY,
            options: atFace
        });
        expect(missing.status).toBe(400);
        expect(JSON.stringify(await missing.json())).toContain(
            "Select a face to stop at"
        );
        expect(
            (await post("/auto-assembly/insert", { ...BODY, stopFace })).status
        ).toBe(400);
        expect(
            (
                await post("/auto-assembly/insert", {
                    ...BODY,
                    options: atFace,
                    stopFace: BODY.targets[0]
                })
            ).status
        ).toBe(400);
    });

    it("refuses an assembly outside a workspace, and ids that aren't ids", async () => {
        expect(
            (
                await post("/auto-assembly/insert", {
                    ...BODY,
                    assembly: { ...ASSEMBLY, instanceType: "v" }
                })
            ).status
        ).toBe(400);
        expect(
            (
                await post("/auto-assembly/insert", {
                    ...BODY,
                    targets: [{ ...BODY.targets[0], entityId: 'a"b' }]
                })
            ).status
        ).toBe(400);
    });
});

describe("POST /api/auto-assembly/declared", () => {
    it("starts a declared-parts run, with no fasteners loaded", async () => {
        const create = vi
            .spyOn(env.AUTO_ASSEMBLY_WORKFLOW, "create")
            .mockResolvedValue({ id: "run-1" } as WorkflowInstance);

        const res = await post("/auto-assembly/declared", {
            assembly: ASSEMBLY
        });
        expect(res.status).toBe(200);
        expect(create.mock.calls[0][0]?.params).toMatchObject({
            kind: AssemblyRunKind.DECLARED_PARTS,
            request: { assembly: ASSEMBLY }
        });
        expect((await res.json<AssemblyJobStatus>()).kind).toBe(
            AssemblyRunKind.DECLARED_PARTS
        );
    });

    it("refuses a second run in an assembly while one goes", async () => {
        await reportJob(env, ASSEMBLY, {
            state: AssemblyJobState.RUNNING,
            jobId: "running"
        });
        vi.spyOn(env.AUTO_ASSEMBLY_WORKFLOW, "get").mockResolvedValue({
            status: () => Promise.resolve({ status: "running" })
        } as unknown as WorkflowInstance);
        expect(
            (await post("/auto-assembly/declared", { assembly: ASSEMBLY }))
                .status
        ).toBe(409);
    });
});

describe("GET /api/auto-assembly/job", () => {
    const readJob = async () =>
        (
            await app.request(
                "/api/auto-assembly/job?documentId=doc&instanceId=ws&elementId=asm",
                {},
                env
            )
        ).json<AssemblyJobStatus>();

    const runEnded = (status: object) =>
        vi.spyOn(env.AUTO_ASSEMBLY_WORKFLOW, "get").mockResolvedValue({
            status: () => Promise.resolve(status)
        } as unknown as WorkflowInstance);

    // KV, read here, can lag what the run wrote from elsewhere
    it("takes how a finished run ended from the run, while KV still says it's going", async () => {
        await reportJob(env, ASSEMBLY, {
            state: AssemblyJobState.RUNNING,
            jobId: "done"
        });
        runEnded({
            status: "complete",
            output: {
                state: AssemblyJobState.COMPLETE,
                jobId: "done",
                result: { inserted: 4, fastened: 4, replaced: 0 }
            }
        });

        const status = await readJob();

        expect(status.state).toBe(AssemblyJobState.COMPLETE);
        expect(status.error).toBeUndefined();
        expect(status.result?.inserted).toBe(4);
    });

    it("reads a run that died without reporting as stopped", async () => {
        await reportJob(env, ASSEMBLY, {
            state: AssemblyJobState.RUNNING,
            jobId: "died",
            tasks: [
                {
                    action: AssemblyTaskAction.INDEX,
                    state: AssemblyTaskState.RUNNING
                }
            ]
        });
        runEnded({ status: "errored" });

        const status = await readJob();

        expect(status.state).toBe(AssemblyJobState.FAILED);
        expect(status.tasks?.[0].state).toBe(AssemblyTaskState.FAILED);
    });
});

describe("POST /api/auto-assembly/prepare", () => {
    it("indexes the assembly with nothing picked, filling the scan cache", async () => {
        const index = vi.spyOn(IndexHoles, "indexHoles").mockResolvedValue({
            circularEdges: [],
            holes: [],
            placed: [],
            replacements: [],
            pickEdges: {},
            unfound: []
        });

        const res = await post("/auto-assembly/prepare", {
            assembly: ASSEMBLY
        });

        expect(res.status).toBe(200);
        expect(index).toHaveBeenCalledWith(
            expect.anything(),
            env.KV,
            ASSEMBLY,
            [],
            [],
            undefined
        );
    });

    it("refuses an assembly that isn't a workspace's", async () => {
        const res = await post("/auto-assembly/prepare", {
            assembly: { ...ASSEMBLY, instanceType: "v" }
        });
        expect(res.status).toBe(400);
    });
});

describe("POST /api/auto-assembly/check", () => {
    const check = {
        assembly: ASSEMBLY,
        selectionMode: SelectionMode.LOCATIONS,
        targets: BODY.targets,
        options: BODY.options
    };

    it("asks Onshape nothing with nothing picked", async () => {
        const index = vi.spyOn(IndexHoles, "indexHoles");
        const res = await post("/auto-assembly/check", {
            ...check,
            targets: []
        });
        expect(await res.json()).toEqual({ problems: [] });
        expect(index).not.toHaveBeenCalled();
    });

    it("says why each pick won't be fastened", async () => {
        publish();
        vi.spyOn(IndexHoles, "indexHoles").mockResolvedValue({
            circularEdges: [],
            holes: [],
            placed: [],
            replacements: [],
            pickEdges: { "top|TOP-top": [] },
            unfound: [
                {
                    key: "top|TOP-top",
                    status: HoleStatus.NO_FIT,
                    reason: "Not a circular edge."
                }
            ]
        });
        const res = await post("/auto-assembly/check", check);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            problems: [
                {
                    key: "top|TOP-top",
                    message: "Not a circular edge.",
                    severity: ProblemSeverity.ERROR
                }
            ]
        });
    });
});

const BOTTOM_TOP = {
    occurrencePath: ["bottom"],
    entityId: "BOTTOM-top",
    entityType: SelectedEntityType.EDGE
};

/** Each Part Studio scanned, with the edges it was asked about. */
function scanned(reads: ReturnType<typeof mockAssemblyReads>) {
    return reads.scan.mock.calls.map(([, path, script]) => ({
        studio: path.elementId,
        edges: [...script.matchAll(/qTransient\("([^"]+)"\)/g)].map(
            (match) => match[1]
        )
    }));
}

describe("POST /api/auto-assembly/check, checked again", () => {
    const check = (targets: unknown[]) =>
        post("/auto-assembly/check", {
            assembly: ASSEMBLY,
            selectionMode: SelectionMode.LOCATIONS,
            targets,
            options: BODY.options
        });

    it("reads the assembly once between edits, and scans only picks it hasn't", async () => {
        const reads = mockAssemblyReads();

        const first = await check(BODY.targets);
        expect(first.status).toBe(200);
        expect(reads.assembly).toHaveBeenCalledTimes(1);
        expect(reads.elements).toHaveBeenCalledTimes(1);
        expect(scanned(reads)).toHaveLength(2);
        expect(scanned(reads)).toEqual(
            expect.arrayContaining([
                { studio: "topStudio", edges: ["TOP-top"] },
                { studio: "bottomStudio", edges: [] }
            ])
        );

        // The same picks again: nothing but the workspace's tabs is asked
        const again = await check(BODY.targets);
        expect(await again.json()).toEqual(await first.json());
        expect(reads.assembly).toHaveBeenCalledTimes(1);
        expect(reads.elements).toHaveBeenCalledTimes(2);
        expect(reads.scan).toHaveBeenCalledTimes(2);

        // One more pick: only its studio is scanned, for it alone
        await check([...BODY.targets, BOTTOM_TOP]);
        expect(reads.assembly).toHaveBeenCalledTimes(1);
        expect(scanned(reads).slice(2)).toEqual([
            { studio: "bottomStudio", edges: ["BOTTOM-top"] }
        ]);
    });

    it("reads nothing again when a tab the assembly doesn't reference is edited", async () => {
        const reads = mockAssemblyReads();
        await check(BODY.targets);

        reads.elements.mockResolvedValue(workspaceElements({ drawing: "d2" }));
        await check(BODY.targets);

        expect(reads.assembly).toHaveBeenCalledTimes(1);
        expect(reads.scan).toHaveBeenCalledTimes(2);
    });

    it("reads again once a studio in it is edited, and scans only that studio", async () => {
        const reads = mockAssemblyReads();
        await check([...BODY.targets, BOTTOM_TOP]);
        expect(reads.scan).toHaveBeenCalledTimes(2);

        // Onshape moves the assembly's microversion with the studio's
        reads.elements.mockResolvedValue(
            workspaceElements({ assembly: "a2", top: "t2" })
        );
        await check([...BODY.targets, BOTTOM_TOP]);

        expect(reads.assembly).toHaveBeenCalledTimes(2);
        expect(scanned(reads).slice(2)).toEqual([
            { studio: "topStudio", edges: ["TOP-top"] }
        ]);
    });
});

describe("POST /api/auto-assembly/check, without options", () => {
    const check = (targets: unknown[]) =>
        post("/auto-assembly/check", {
            assembly: ASSEMBLY,
            selectionMode: SelectionMode.LOCATIONS,
            targets
        });

    it("scans only the Part Studios picked in", async () => {
        const reads = mockAssemblyReads();
        await check(BODY.targets);
        expect(scanned(reads)).toEqual([
            { studio: "topStudio", edges: ["TOP-top"] }
        ]);
    });

    it("keeps the last assembly read while it has every pick", async () => {
        const reads = mockAssemblyReads();
        await check(BODY.targets);

        // An insert moves the assembly's microversion and no studio's
        reads.elements.mockResolvedValue(workspaceElements({ assembly: "a2" }));
        await check([...BODY.targets, BOTTOM_TOP]);
        expect(reads.assembly).toHaveBeenCalledTimes(1);

        const res = await check([
            { ...BOTTOM_TOP, occurrencePath: ["inserted"] }
        ]);
        expect(reads.assembly).toHaveBeenCalledTimes(2);
        expect((await res.json<PickCheckOut>()).problems).toEqual([
            {
                key: "inserted|BOTTOM-top",
                message: "Couldn't find this part in the assembly.",
                severity: ProblemSeverity.ERROR
            }
        ]);
    });

    it("reads the assembly again when the last read leaves a pick unresolved", async () => {
        const reads = mockAssemblyReads();
        await check(BODY.targets);
        reads.elements.mockResolvedValue(workspaceElements({ assembly: "a2" }));

        await check([{ ...BOTTOM_TOP, entityId: "BOTTOM-gone" }]);

        expect(reads.assembly).toHaveBeenCalledTimes(2);
    });
});

describe("GET /api/auto-assembly/parts", () => {
    it("serves the fasteners the library loaded, and null before it loads them", async () => {
        const read = async () =>
            (await app.request("/api/auto-assembly/parts?v=1", {}, env)).json();
        expect(await read()).toBeNull();
        publish();
        expect(await read()).toEqual(FASTENER_SET);
    });

    it("is immutable under a cache version, and refused without one", async () => {
        publish();
        const pinned = await app.request(
            "/api/auto-assembly/parts?v=1",
            {},
            env
        );
        expect(pinned.headers.get("Cache-Control")).toContain("immutable");
        const unpinned = await app.request("/api/auto-assembly/parts", {}, env);
        expect(unpinned.status).toBe(400);
    });
});
