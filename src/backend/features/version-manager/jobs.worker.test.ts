import { env } from "cloudflare:workers";
import { afterEach, expect, it, vi } from "vitest";
import {
    toWorkspacePath,
    VersionJobState,
    VersionTaskAction,
    VersionTaskState
} from "./contract";
import { getJobStatus, reportJob } from "./jobs";

const WORKSPACE = toWorkspacePath("doc", "doc-w");

afterEach(() => vi.restoreAllMocks());

it("reads a run that died before it could report as failed where it stopped", async () => {
    vi.spyOn(env.VERSION_MANAGER_WORKFLOW, "get").mockResolvedValue({
        status: () =>
            Promise.resolve({
                status: "errored",
                error: { name: "Error", message: "Onshape API error 503" }
            })
    } as unknown as WorkflowInstance);
    const task = (action: VersionTaskAction, state: VersionTaskState) => ({
        action,
        state,
        workspace: WORKSPACE
    });
    await reportJob(env, WORKSPACE, {
        state: VersionJobState.RUNNING,
        jobId: "died",
        tasks: [
            task(VersionTaskAction.VERSION, VersionTaskState.DONE),
            task(VersionTaskAction.REFERENCES, VersionTaskState.RUNNING),
            task(VersionTaskAction.VERSION, VersionTaskState.PENDING)
        ]
    });

    const status = await getJobStatus(env, WORKSPACE);

    expect(status.state).toBe(VersionJobState.FAILED);
    expect(status.tasks?.map((each) => each.state)).toEqual([
        VersionTaskState.DONE,
        VersionTaskState.FAILED,
        VersionTaskState.SKIPPED
    ]);
    expect(status.tasks?.[1].reason).toMatch(/having problems/);
});

it("keeps a running mark when the platform can't be asked", async () => {
    vi.spyOn(env.VERSION_MANAGER_WORKFLOW, "get").mockRejectedValue(
        new Error("unavailable")
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await reportJob(env, WORKSPACE, {
        state: VersionJobState.RUNNING,
        jobId: "unreadable"
    });

    expect((await getJobStatus(env, WORKSPACE)).state).toBe(
        VersionJobState.RUNNING
    );
});
