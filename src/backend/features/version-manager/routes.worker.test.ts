import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import { getDb } from "../../db/client";
import * as Permissions from "../../lib/onshape/endpoints/permissions";
import { OnshapePermission } from "../../lib/onshape/endpoints/permissions";
import {
    PullScopeKind,
    PushScopeKind,
    toWorkspacePath,
    VersionJobState,
    type WorkspacePath
} from "./contract";
import { Hint } from "../hints/contract";
import { getSeenHints } from "../hints/store";
import * as Jobs from "./jobs";
import { addLink } from "./links";
import { workspaceLinks } from "./schema";

const db = getDb(env.DB);
const app = createTestApp();

const ws = (documentId: string, instanceId = `${documentId}-w`) =>
    toWorkspacePath(documentId, instanceId);

const ROOT = ws("root");
const CHILD = ws("child");

/** Grants each workspace's document what `granted` lists for it, and nothing else. */
function grant(granted: Record<string, OnshapePermission[]>) {
    vi.spyOn(Permissions, "hasPermissions").mockImplementation(
        (_client, path, ...needed) =>
            Promise.resolve(
                needed.every((each) =>
                    (granted[path.documentId] ?? []).includes(each)
                )
            )
    );
}

const ALL = [
    OnshapePermission.READ,
    OnshapePermission.WRITE,
    OnshapePermission.LINK
];

function post(path: string, body: unknown) {
    return app.request(`/api${path}`, jsonRequest("POST", body), env);
}

const toInput = (workspace: WorkspacePath) => ({
    documentId: workspace.documentId,
    instanceId: workspace.instanceId
});

beforeEach(async () => {
    await db.delete(workspaceLinks);
    await addLink(db, ROOT, CHILD);
});

afterEach(() => vi.restoreAllMocks());

describe("version manager routes", () => {
    it("shows a run only to somebody who may read the document", async () => {
        grant({});
        const res = await app.request(
            `/api/version-job?${new URLSearchParams(toInput(ROOT))}`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(403);
    });

    it("refuses a push before it starts when a child is not writable", async () => {
        grant({ root: ALL, child: [OnshapePermission.READ] });
        const res = await post("/push-version", { workspace: toInput(ROOT) });
        expect(res.status).toBe(403);
    });

    it("refuses an update-only push that would have to recurse", async () => {
        grant({ root: ALL, child: ALL });
        const res = await post("/push-version", {
            workspace: toInput(ROOT),
            scope: { kind: PushScopeKind.DESCENDANTS },
            updateOnly: true
        });
        expect(res.status).toBe(400);
    });

    it("refuses a recursive push that would version one document twice", async () => {
        const branch = ws("child", "branch-w");
        await addLink(db, CHILD, branch);
        grant({ root: ALL, child: ALL });
        const res = await post("/push-version", {
            workspace: toInput(ROOT),
            scope: { kind: PushScopeKind.DESCENDANTS }
        });
        expect(res.status).toBe(409);
    });

    it("refuses a second run while one from the workspace is going", async () => {
        grant({ root: ALL, child: ALL });
        vi.spyOn(Jobs, "getJobStatus").mockResolvedValue({
            state: VersionJobState.RUNNING,
            jobId: "running"
        });
        const res = await post("/push-version", { workspace: toInput(ROOT) });
        expect(res.status).toBe(409);
    });

    it("needs more than read on a parent it would version", async () => {
        grant({ child: ALL, root: [OnshapePermission.READ] });
        const res = await post("/pull-references", {
            workspace: toInput(CHILD),
            scope: { kind: PullScopeKind.ONE, workspace: toInput(ROOT) }
        });
        expect(res.status).toBe(403);
    });

    it("records a started run, which stops the page being pointed out", async () => {
        grant({ root: ALL, child: ALL });
        await env.KV.delete("seen-hints:test-user");
        vi.spyOn(env.VERSION_MANAGER_WORKFLOW, "create").mockResolvedValue({
            id: "started"
        } as WorkflowInstance);
        const res = await app.request(
            "/api/push-version",
            {
                ...jsonRequest("POST", { workspace: toInput(ROOT) }),
                headers: {
                    "Content-Type": "application/json",
                    Cookie: "frc-design-app-session=session"
                }
            },
            env
        );
        expect(res.status).toBe(200);
        expect(await getSeenHints(env.KV, "test-user")).toEqual([
            Hint.RAN_VERSION_JOB
        ]);
    });
});
