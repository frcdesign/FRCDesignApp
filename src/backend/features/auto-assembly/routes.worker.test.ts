import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as FastenerSets from "./fastener-set";
import { FASTENER_SET } from "../../../__test_utils__/fastener-set";
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import { ASSEMBLY, BODY } from "../../../__test_utils__/auto-assembly-fixtures";
import { Program } from "./catalog";
import {
    AssemblyJobState,
    AssemblyTaskState,
    HoleStatus,
    type AssemblyJobStatus,
    SelectedEntityType,
    SelectionMode
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
                Cookie: "frc-design-app-session=session"
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
            problems: [{ key: "top|TOP-top", message: "Not a circular edge." }]
        });
    });
});

describe("GET /api/auto-assembly/parts", () => {
    it("serves the fasteners the library loaded, and null before it loads them", async () => {
        const read = async () =>
            (await app.request("/api/auto-assembly/parts", {}, env)).json();
        expect(await read()).toBeNull();
        publish();
        expect(await read()).toEqual(FASTENER_SET);
    });
});
