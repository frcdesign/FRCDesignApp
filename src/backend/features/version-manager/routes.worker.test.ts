import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import { getDb } from "../../db/client";
import * as Documents from "../../lib/onshape/endpoints/documents";
import * as Permissions from "../../lib/onshape/endpoints/permissions";
import type {
    OnshapeDocumentContents,
    OnshapeDocumentInfo,
    OnshapeExternalReferences
} from "../../lib/onshape/types";
import * as Transient from "../webhooks/transient";
import { OnshapePermission } from "../../lib/onshape/endpoints/permissions";
import {
    LinkDirection,
    PullScopeKind,
    PushScopeKind,
    toWorkspacePath,
    VersionJobState,
    type WorkspacePath
} from "./contract";
import * as Jobs from "./jobs";
import * as WorkspaceCache from "./workspace-cache";
import { addLink, getParentLinks } from "./links";
import { workspaceLinks } from "./schema";

const db = getDb(env.DB);
const app = createTestApp();

const ws = (documentId: string, instanceId = `${documentId}-w`) =>
    toWorkspacePath(documentId, instanceId);

const ROOT = ws("root");
const CHILD = ws("child");

/** Grants each workspace's document what `granted` lists for it, and nothing else. */
function grant(granted: Record<string, OnshapePermission[]>) {
    vi.spyOn(Permissions, "getPermissions").mockImplementation(
        (_client, path) => Promise.resolve(granted[path.documentId] ?? [])
    );
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

/** As `post`, under a session, which a started run carries. */
function postSignedIn(path: string, body: unknown) {
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

    it("starts a recursive push that versions only what the documents past it reference", async () => {
        const grandchild = ws("grandchild");
        await addLink(db, CHILD, grandchild);
        // No link permission on the grandchild: nothing cuts a version of it.
        grant({
            root: ALL,
            child: ALL,
            grandchild: [OnshapePermission.READ, OnshapePermission.WRITE]
        });
        const create = vi
            .spyOn(env.VERSION_MANAGER_WORKFLOW, "create")
            .mockResolvedValue({ id: "started" } as WorkflowInstance);
        const res = await postSignedIn("/push-version", {
            workspace: toInput(ROOT),
            scope: { kind: PushScopeKind.DESCENDANTS }
        });
        expect(res.status).toBe(200);
        expect(create.mock.calls[0][0]?.params).toMatchObject({
            steps: [CHILD, grandchild],
            leaves: [grandchild]
        });
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

    it("refuses an update-only pull that would have to recurse", async () => {
        grant({ root: ALL, child: ALL });
        const res = await post("/pull-references", {
            workspace: toInput(CHILD),
            scope: { kind: PullScopeKind.ANCESTORS },
            updateOnly: true
        });
        expect(res.status).toBe(400);
    });

    it("refuses a recursive pull before it starts when a grandparent is not writable", async () => {
        const top = ws("top");
        await addLink(db, top, ROOT);
        grant({ child: ALL, root: ALL, top: [OnshapePermission.READ] });
        const res = await post("/pull-references", {
            workspace: toInput(CHILD),
            scope: {
                kind: PullScopeKind.ONE,
                workspace: toInput(ROOT),
                recursive: true
            }
        });
        expect(res.status).toBe(403);
    });

    it("starts a recursive pull from the top, moving each parent before versioning it", async () => {
        const top = ws("top");
        await addLink(db, top, ROOT);
        grant({ child: ALL, root: ALL, top: ALL });
        const create = vi
            .spyOn(env.VERSION_MANAGER_WORKFLOW, "create")
            .mockResolvedValue({ id: "started" } as WorkflowInstance);
        const res = await postSignedIn("/pull-references", {
            workspace: toInput(CHILD),
            scope: { kind: PullScopeKind.ANCESTORS }
        });
        expect(res.status).toBe(200);
        expect(create.mock.calls[0][0]?.params).toMatchObject({
            sources: [top, ROOT],
            referencing: [ROOT],
            targets: [{ workspace: ROOT }]
        });
    });

    // A second workspace of a document already linked is still that document.
    it("refuses a document already linked, either way round", async () => {
        grant({ root: ALL, child: ALL });
        const res = await post("/workspace-links", {
            workspace: toInput(ROOT),
            linked: toInput(ws("child", "child-other")),
            direction: LinkDirection.PARENT
        });
        expect(res.status).toBe(409);
        expect(await res.json()).toMatchObject({
            message: "That document is already linked as a child."
        });
    });

    it("names what it linked", async () => {
        grant({ root: ALL, other: ALL });
        vi.spyOn(WorkspaceCache, "describeWorkspace").mockResolvedValue({
            documentName: "Gearbox",
            workspaceName: "Main"
        });
        const res = await post("/workspace-links", {
            workspace: toInput(ROOT),
            linked: toInput(ws("other")),
            direction: LinkDirection.CHILD
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            documentName: "Gearbox",
            workspaceName: "Main"
        });
    });

    it("asks Onshape for a caller's permissions once, until the document is shared or unshared", async () => {
        grant({ root: ALL });
        const readJob = () =>
            app.request(
                `/api/version-job?${new URLSearchParams(toInput(ROOT))}`,
                jsonRequest("GET"),
                env
            );

        expect((await readJob()).status).toBe(200);
        expect((await readJob()).status).toBe(200);
        expect(Permissions.getPermissions).toHaveBeenCalledOnce();

        const delivery = await app.request(
            `/api/webhooks/linked-workspace?documentId=${ROOT.documentId}&workspaceId=${ROOT.instanceId}`,
            // As Onshape sent it when a document was shared with someone.
            jsonRequest("POST", {
                event: "onshape.document.lifecycle.shared",
                documentId: ROOT.documentId,
                entryType: "USER",
                shareAction: "Create",
                oldPermissionSet: [],
                newPermissionSet: ["WRITE", "COPY", "EXPORT", "COMMENT"]
            }),
            env
        );
        expect(delivery.status).toBe(200);

        expect((await readJob()).status).toBe(200);
        expect(Permissions.getPermissions).toHaveBeenCalledTimes(2);
    });

    it("counts a parent's unversioned changes on a request of its own", async () => {
        grant({ root: ALL });
        vi.spyOn(WorkspaceCache, "getUnversionedChanges").mockResolvedValue(3);

        const res = await app.request(
            `/api/workspace-changes?${new URLSearchParams(toInput(ROOT))}`,
            jsonRequest("GET"),
            env
        );

        expect(await res.json()).toEqual({ changes: 3 });
    });

    it("counts changes only for somebody who may read the parent", async () => {
        grant({});
        const count = vi.spyOn(WorkspaceCache, "getUnversionedChanges");

        const res = await app.request(
            `/api/workspace-changes?${new URLSearchParams(toInput(ROOT))}`,
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(403);
        expect(count).not.toHaveBeenCalled();
    });

    it("reads a library document's default workspace, once, with each tab's microversion", async () => {
        grant({ root: ALL });
        const getDocument = vi
            .spyOn(Documents, "getDocument")
            .mockResolvedValue({
                id: ROOT.documentId,
                defaultWorkspace: { id: ROOT.instanceId }
            } as OnshapeDocumentInfo);
        vi.spyOn(Transient, "watchLinkedWorkspace").mockResolvedValue();
        vi.spyOn(Documents, "getInsertables").mockResolvedValue({
            changesSinceVersionSave: 2
        });
        const getContents = vi
            .spyOn(Documents, "getContents")
            .mockResolvedValue({
                elements: [{ id: "tab", microversionId: "mv" }]
            } as OnshapeDocumentContents);

        const read = (elements: boolean) =>
            app.request(
                `/api/workspace-changes?${new URLSearchParams({ documentId: ROOT.documentId, elements: String(elements) })}`,
                jsonRequest("GET"),
                env
            );

        expect(await (await read(false)).json()).toEqual({ changes: 2 });
        expect(getContents).not.toHaveBeenCalled();
        expect(await (await read(true)).json()).toEqual({
            changes: 2,
            elements: { tab: "mv" }
        });
        expect(getDocument).toHaveBeenCalledOnce();
        expect(getContents.mock.calls[0][1]).toEqual(ROOT);
    });

    it("lists a document's tabs only for somebody who may read it", async () => {
        grant({});
        vi.spyOn(Documents, "getDocument").mockResolvedValue({
            id: ROOT.documentId,
            defaultWorkspace: { id: ROOT.instanceId }
        } as OnshapeDocumentInfo);
        vi.spyOn(Transient, "watchLinkedWorkspace").mockResolvedValue();
        const getContents = vi.spyOn(Documents, "getContents");

        const res = await app.request(
            `/api/workspace-changes?documentId=${ROOT.documentId}&elements=true`,
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(403);
        expect(getContents).not.toHaveBeenCalled();
    });

    it("forgets what is cached of each linked workspace on a refresh", async () => {
        grant({ child: ALL });
        const forget = vi
            .spyOn(WorkspaceCache, "forgetWorkspace")
            .mockResolvedValue();
        const res = await post("/workspace-links/refresh", {
            workspace: toInput(CHILD)
        });
        expect(res.status).toBe(200);
        expect(forget.mock.calls.map((call) => call[1])).toEqual([ROOT]);
    });
    it("suggests each referenced document, unlinked and readable, at its default workspace", async () => {
        grant({ child: ALL, gearbox: ALL, secret: [] });
        vi.spyOn(Documents, "getExternalReferences").mockResolvedValue({
            elementExternalReferences: {
                assembly: [
                    reference("gearbox", "v1"),
                    // Already linked, as this workspace's parent.
                    reference("root", "v2"),
                    reference("secret", "v3")
                ],
                drawing: [reference("gearbox", "v1"), reference("child", "v4")]
            }
        } satisfies OnshapeExternalReferences);
        vi.spyOn(Documents, "getDocument").mockImplementation((_client, path) =>
            Promise.resolve({
                id: path.documentId,
                name: `${path.documentId} document`,
                defaultWorkspace: { id: `${path.documentId}-main` }
            } as OnshapeDocumentInfo)
        );
        vi.spyOn(WorkspaceCache, "describeWorkspace").mockResolvedValue({
            documentName: "Gearbox",
            workspaceName: "Main"
        });
        vi.spyOn(Transient, "watchLinkedWorkspace").mockResolvedValue();

        const res = await app.request(
            `/api/workspace-link-suggestions?${new URLSearchParams(toInput(CHILD))}`,
            jsonRequest("GET"),
            env
        );

        expect(await res.json()).toEqual({
            suggestions: [
                {
                    workspace: ws("gearbox", "gearbox-main"),
                    documentName: "Gearbox",
                    workspaceName: "Main"
                }
            ]
        });
    });

    it("links every readable parent asked for, skipping those already linked", async () => {
        grant({ child: ALL, gearbox: ALL, intake: ALL, secret: [] });
        const res = await post("/workspace-links/parents", {
            workspace: toInput(CHILD),
            parents: [
                toInput(ws("gearbox")),
                toInput(ws("gearbox", "gearbox-branch")),
                toInput(ws("root", "root-other")),
                toInput(ws("secret")),
                toInput(ws("intake"))
            ]
        });

        expect(await res.json()).toEqual({ linked: 2 });
        const parents = await getParentLinks(db, CHILD);
        expect(parents.map((row) => row.sourceDocumentId).sort()).toEqual([
            "gearbox",
            "intake",
            "root"
        ]);
    });

    it("links no parents for somebody who can't edit the workspace", async () => {
        grant({ child: [OnshapePermission.READ], gearbox: ALL });
        const res = await post("/workspace-links/parents", {
            workspace: toInput(CHILD),
            parents: [toInput(ws("gearbox"))]
        });

        expect(res.status).toBe(403);
        expect(await getParentLinks(db, CHILD)).toHaveLength(1);
    });
});

function reference(documentId: string, versionId: string) {
    return {
        documentId,
        id: versionId,
        isOutOfDate: false,
        referencedElements: ["tab"]
    };
}
