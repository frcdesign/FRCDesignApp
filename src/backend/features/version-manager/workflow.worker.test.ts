import { env } from "cloudflare:workers";
import { introspectWorkflowInstance } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as RequestAuth from "../auth/request-auth";
import * as VersionEndpoints from "../../lib/onshape/endpoints/versions";
import { OnshapeApiError, type OAuthApi } from "../../lib/onshape/client";
import type { OnshapeVersionInfo } from "../../lib/onshape/types";
import {
    jobOutcome,
    PushScopeKind,
    VersionJobKind,
    VersionJobOutcome,
    VersionJobState,
    VersionTaskAction,
    VersionTaskState,
    type VersionJobStatus,
    type WorkspacePath
} from "./contract";
import { getJobStatus } from "./jobs";
import * as References from "./references";
import type { VersionJobParams } from "./workflow";

const ws = (documentId: string): WorkspacePath => ({
    documentId,
    instanceId: `${documentId}-w`,
    instanceType: "w"
});

const ROOT = ws("root");
const CHILD = ws("child");
const GRANDCHILD = ws("grandchild");

const BASE = {
    sessionId: "session",
    userId: "user",
    workspace: ROOT,
    updateOnly: false,
    targets: [],
    documentNames: {},
    description: ""
};

function push(
    steps: WorkspacePath[],
    options: { recursive?: boolean; updateOnly?: boolean } = {}
): VersionJobParams {
    return {
        ...BASE,
        kind: VersionJobKind.PUSH,
        scope: PushScopeKind.CHILDREN,
        steps,
        recursive: options.recursive ?? false,
        updateOnly: options.updateOnly ?? false
    };
}

function version(id: string, name: string, createdAt = new Date()) {
    return { id, name, createdAt: createdAt.toISOString() };
}

/** Runs the workflow to its end and answers what it stored. */
async function run(
    id: string,
    params: VersionJobParams
): Promise<VersionJobStatus> {
    await using instance = await introspectWorkflowInstance(
        env.VERSION_MANAGER_WORKFLOW,
        id
    );
    await instance.modify(async (m) => {
        await m.disableRetryDelays();
    });
    await env.VERSION_MANAGER_WORKFLOW.create({ id, params });
    await instance.waitForStatus("complete");
    return getJobStatus(env, ROOT);
}

let versionsByDocument: Record<string, OnshapeVersionInfo[]>;

beforeEach(() => {
    versionsByDocument = {};
    vi.spyOn(RequestAuth, "getOnshapeApiFromSessionId").mockResolvedValue(
        {} as OAuthApi
    );
    vi.spyOn(VersionEndpoints, "getVersions").mockImplementation(
        (_client, path) =>
            Promise.resolve(versionsByDocument[path.documentId] ?? [])
    );
});

afterEach(() => vi.restoreAllMocks());

describe("VersionManagerWorkflow", () => {
    it("pins each workspace a recursive push reaches to the versions cut before it", async () => {
        vi.spyOn(VersionEndpoints, "createVersion").mockImplementation(
            (_client, path, name) =>
                Promise.resolve(version(`${path.documentId}-v`, name))
        );
        const update = vi
            .spyOn(References, "updateOutdatedReferences")
            .mockResolvedValue({ updatedElements: 2 });

        const status = await run(
            "recursive",
            push([CHILD, GRANDCHILD], { recursive: true })
        );

        expect(update).toHaveBeenNthCalledWith(1, expect.anything(), CHILD, {
            onlyDocumentIds: ["root"],
            pinnedVersions: { root: "root-v" }
        });
        expect(update).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            GRANDCHILD,
            {
                onlyDocumentIds: ["root", "child"],
                pinnedVersions: { root: "root-v", child: "child-v" }
            }
        );
        expect(status.state).toBe(VersionJobState.COMPLETE);
        expect(status.result).toEqual({
            createdVersions: 3,
            updatedElements: 4
        });
        expect(jobOutcome(status)).toBe(VersionJobOutcome.SUCCESS);
    });

    it("numbers an unnamed version from that document's own history", async () => {
        versionsByDocument.root = [version("old", "V7", new Date(0))];
        const create = vi
            .spyOn(VersionEndpoints, "createVersion")
            .mockImplementation((_client, _path, name) =>
                Promise.resolve(version("v", name))
            );
        vi.spyOn(References, "updateOutdatedReferences").mockResolvedValue({
            updatedElements: 0
        });

        await run("numbered", push([CHILD]));

        expect(create).toHaveBeenCalledWith(expect.anything(), ROOT, "V8", "");
    });

    it("finds the version a retried step already cut instead of cutting another", async () => {
        const create = vi
            .spyOn(VersionEndpoints, "createVersion")
            .mockImplementation((_client, path, name) => {
                // Onshape cut it, but the answer never arrived.
                versionsByDocument[path.documentId] = [version("cut", name)];
                return Promise.reject(
                    new OnshapeApiError("Onshape API error 503", 503)
                );
            });
        const update = vi
            .spyOn(References, "updateOutdatedReferences")
            .mockResolvedValue({ updatedElements: 1 });

        const status = await run("retried", {
            ...push([CHILD]),
            name: "Release"
        });

        expect(create).toHaveBeenCalledOnce();
        expect(update).toHaveBeenCalledWith(expect.anything(), CHILD, {
            onlyDocumentIds: ["root"],
            pinnedVersions: { root: "cut" }
        });
        expect(jobOutcome(status)).toBe(VersionJobOutcome.SUCCESS);
    });

    it("carries on past a document it may not edit, and says why in its own words", async () => {
        const other = ws("other");
        vi.spyOn(VersionEndpoints, "createVersion").mockResolvedValue(
            version("root-v", "V1")
        );
        const update = vi
            .spyOn(References, "updateOutdatedReferences")
            .mockImplementation((_client, workspace) =>
                workspace.documentId === "child"
                    ? Promise.reject(
                          new OnshapeApiError(
                              "Onshape API error 403: raw detail",
                              403
                          )
                      )
                    : Promise.resolve({ updatedElements: 3 })
            );

        const status = await run("partial", push([CHILD, other]));

        // Refused is refused: not retried.
        expect(update).toHaveBeenCalledTimes(2);
        const [, childTask, otherTask] = status.tasks ?? [];
        expect(childTask).toMatchObject({
            action: VersionTaskAction.REFERENCES,
            state: VersionTaskState.FAILED,
            reason: "You don't have permission to edit this document."
        });
        expect(otherTask).toMatchObject({
            state: VersionTaskState.DONE,
            updatedElements: 3
        });
        expect(jobOutcome(status)).toBe(VersionJobOutcome.PARTIAL);
    });

    it("skips moving references onto a version it could not cut", async () => {
        vi.spyOn(VersionEndpoints, "createVersion").mockRejectedValue(
            new OnshapeApiError("Onshape API error 404", 404)
        );
        const update = vi.spyOn(References, "updateOutdatedReferences");

        const status = await run("unversioned", push([CHILD]));

        expect(update).not.toHaveBeenCalled();
        expect(status.tasks?.map((task) => task.state)).toEqual([
            VersionTaskState.FAILED,
            VersionTaskState.SKIPPED
        ]);
        expect(jobOutcome(status)).toBe(VersionJobOutcome.FAILED);
    });

    it("moves an update-only push onto the newest version without cutting one", async () => {
        const create = vi.spyOn(VersionEndpoints, "createVersion");
        const update = vi
            .spyOn(References, "updateOutdatedReferences")
            .mockResolvedValue({ updatedElements: 1 });

        await run("update-only", push([CHILD], { updateOnly: true }));

        expect(create).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledWith(expect.anything(), CHILD, {
            onlyDocumentIds: ["root"]
        });
    });
});
