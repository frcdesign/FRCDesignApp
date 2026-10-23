import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import {
    ASSEMBLY,
    BODY
} from "../../../__test_utils__/quick-fastener-fixtures";
import * as Studios from "./studios";
import { Program } from "./catalog";
import {
    FastenerJobState,
    FastenerTaskState,
    type FastenerJobStatus,
    SelectedEntityType,
    SelectionMode
} from "./contract";
import { reportJob } from "./jobs";

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
    vi.spyOn(Studios, "getStudioLocation").mockImplementation((kind) => ({
        documentId: "lib",
        versionId: "libv",
        elementId: `${kind}Studio`
    }));
}

beforeEach(async () => {
    for (const key of (await env.KV.list({ prefix: "fastener-job" })).keys) {
        await env.KV.delete(key.name);
    }
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("POST /api/quick-fastener/insert", () => {
    it("starts a run, and marks it going with every step to come", async () => {
        publish();
        const create = vi
            .spyOn(env.QUICK_FASTENER_WORKFLOW, "create")
            .mockResolvedValue({ id: "run-1" } as WorkflowInstance);
        vi.spyOn(env.QUICK_FASTENER_WORKFLOW, "get").mockResolvedValue({
            status: () => Promise.resolve({ status: "running" })
        } as unknown as WorkflowInstance);

        const res = await post("/quick-fastener/insert", BODY);
        expect(res.status).toBe(200);
        expect(create.mock.calls[0][0]?.params?.request).toMatchObject({
            assembly: ASSEMBLY,
            selectionMode: SelectionMode.LOCATIONS
        });

        const job = await app.request(
            "/api/quick-fastener/job?documentId=doc&instanceId=ws&elementId=asm",
            {},
            env
        );
        const status = await job.json<FastenerJobStatus>();
        expect(status.state).toBe(FastenerJobState.RUNNING);
        expect(status.tasks?.map((task) => task.state)).toEqual([
            FastenerTaskState.PENDING,
            FastenerTaskState.PENDING,
            FastenerTaskState.PENDING
        ]);
    });

    it("says so until the parts are published", async () => {
        expect((await post("/quick-fastener/insert", BODY)).status).toBe(503);
    });

    it("refuses a second run in an assembly while one goes", async () => {
        publish();
        await reportJob(env, ASSEMBLY, {
            state: FastenerJobState.RUNNING,
            jobId: "running"
        });
        vi.spyOn(env.QUICK_FASTENER_WORKFLOW, "get").mockResolvedValue({
            status: () => Promise.resolve({ status: "running" })
        } as unknown as WorkflowInstance);
        expect((await post("/quick-fastener/insert", BODY)).status).toBe(409);
    });

    it("refuses FTC, whose fasteners aren't in yet", async () => {
        const res = await post("/quick-fastener/insert", {
            ...BODY,
            options: { ...BODY.options, program: Program.FTC }
        });
        expect(res.status).toBe(400);
    });

    it("refuses a part its vendor doesn't make, or a nut washer without a nut", async () => {
        publish();
        const insert = (options: object) =>
            post("/quick-fastener/insert", {
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
            (await post("/quick-fastener/insert", { ...BODY, targets: [face] }))
                .status
        ).toBe(400);
        expect(
            (
                await post("/quick-fastener/insert", {
                    ...BODY,
                    excluded: BODY.targets
                })
            ).status
        ).toBe(400);
    });

    it("refuses an assembly outside a workspace, and ids that aren't ids", async () => {
        expect(
            (
                await post("/quick-fastener/insert", {
                    ...BODY,
                    assembly: { ...ASSEMBLY, instanceType: "v" }
                })
            ).status
        ).toBe(400);
        expect(
            (
                await post("/quick-fastener/insert", {
                    ...BODY,
                    targets: [{ ...BODY.targets[0], entityId: 'a"b' }]
                })
            ).status
        ).toBe(400);
    });
});
