/**
 * What the version manager's routes take and answer. A leaf: the frontend
 * imports it, so nothing Worker-only belongs here.
 */
import { type InstancePath } from "../../lib/onshape/path";

/**
 * The only instance the version manager acts on. A version is a snapshot with
 * no references to update, and a microversion cannot be written to at all.
 */
export type WorkspacePath = InstancePath & { instanceType: "w" };

export function toWorkspacePath(
    documentId: string,
    workspaceId: string
): WorkspacePath {
    return { documentId, instanceId: workspaceId, instanceType: "w" };
}

export function isSameWorkspace(a: WorkspacePath, b: WorkspacePath): boolean {
    return a.documentId === b.documentId && a.instanceId === b.instanceId;
}

/**
 * Which side of a link a workspace is being asked about, from the workspace the
 * panel is open in:
 *
 * - `parent` — a workspace it references, which it pulls from.
 * - `child` — a workspace that references it, which it pushes to.
 *
 * Note this is the opposite of an assembly tree's sense, where the assembly is
 * the parent of the parts in it. Here the document a change starts in is the
 * parent, and the change flows down to its children.
 */
export enum LinkDirection {
    PARENT = "parent",
    CHILD = "child"
}

/**
 * A linked workspace as the client shows it. The names are absent when the
 * caller cannot read the document: the link is still theirs to see and remove,
 * but what it points at is not theirs to know.
 */
export interface LinkedWorkspace {
    linkId: string;
    workspace: WorkspacePath;
    isOpenable: boolean;
    /** Whether the caller may run a push that writes to this workspace. */
    canPush: boolean;
    documentName?: string;
    workspaceName?: string;
}

export interface WorkspaceLinksData {
    parents: LinkedWorkspace[];
    children: LinkedWorkspace[];
}

/**
 * How far a push travels.
 *
 * - `direct` — this workspace's children, left un-versioned.
 * - `recursive` — every descendant, versioning each so the next one has
 *   something to reference.
 * - `one` — a single child, which is what a row's own push does.
 */
export type PushScope =
    | { kind: "direct" }
    | { kind: "recursive" }
    | { kind: "one"; workspace: WorkspacePath };

/**
 * Where a pull takes its versions from.
 *
 * - `parents` — this workspace's linked parents.
 * - `all` — every out-of-date reference, linked or not.
 * - `one` — a single parent, which is what a row's own pull does.
 */
export type PullScope =
    | { kind: "parents" }
    | { kind: "all" }
    | { kind: "one"; workspace: WorkspacePath };

/** What a finished push or pull did. */
export interface VersionJobResult {
    /** Workspaces whose references were updated. */
    updatedWorkspaces: number;
    /** Tabs whose references were repointed. */
    updatedElements: number;
    /**
     * Tabs Onshape refused to update. The run carries on past them, so a
     * non-zero count is the only sign that it did not fully land.
     */
    failedElements: number;
    /** Versions the run cut, the one it started from included. */
    createdVersions: number;
}

export enum VersionJobState {
    /** No run has been started from this workspace, or the last one aged out. */
    NONE = "none",
    RUNNING = "running",
    COMPLETE = "complete",
    FAILED = "failed"
}

export interface VersionJobStatus {
    state: VersionJobState;
    jobId?: string;
    result?: VersionJobResult;
    /** Why it failed, when it did. Written for the user. */
    error?: string;
}

/** The empty result, which is also what a run that found nothing to do returns. */
export const EMPTY_JOB_RESULT: VersionJobResult = {
    updatedWorkspaces: 0,
    updatedElements: 0,
    failedElements: 0,
    createdVersions: 0
};

/** How long a version name may be, matching what Onshape accepts. */
export const MAX_VERSION_NAME_LENGTH = 256;
