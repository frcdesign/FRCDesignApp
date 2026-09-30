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
 * One workspace as one string: what a graph walk keys by, what a job is stored
 * under, and what a client's push socket is tagged with.
 */
export function workspaceKey(workspace: WorkspacePath): string {
    return `${workspace.documentId}|${workspace.instanceId}`;
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
    documentName?: string;
    workspaceName?: string;
    /**
     * Parents only: how far this one has moved since its own last version. A
     * pull moves onto a version, so these are the edits it would leave behind.
     * Absent rather than zero where Onshape would not say, zero meaning caught
     * up.
     */
    unversionedChanges?: number;
}

export interface WorkspaceLinksData {
    parents: LinkedWorkspace[];
    children: LinkedWorkspace[];
    /** What Onshape calls the workspace's own document, which the copy names. */
    documentName: string;
}

/** How far a push travels; see {@link PushScope}. */
export enum PushScopeKind {
    CHILDREN = "children",
    DESCENDANTS = "descendants",
    ONE = "one"
}

/**
 * What a push reaches.
 *
 * - `children` — this workspace's children, left un-versioned.
 * - `descendants` — every workspace below it, versioning each so the next one
 *   has something to reference.
 * - `one` — a single child, which is what a row's own push does; `recursive`
 *   carries it on through that child's own descendants.
 */
export type PushScope =
    | { kind: PushScopeKind.CHILDREN }
    | { kind: PushScopeKind.DESCENDANTS }
    | { kind: PushScopeKind.ONE; workspace: WorkspacePath; recursive: boolean };

/** Where a pull takes its versions from; see {@link PullScope}. */
export enum PullScopeKind {
    PARENTS = "parents",
    ALL = "all",
    ONE = "one"
}

/**
 * What a pull reads.
 *
 * - `parents` — this workspace's linked parents.
 * - `all` — every out-of-date reference, linked or not.
 * - `one` — a single parent, which is what a row's own pull does.
 *
 * There is no recursive pull: a pull only writes to this workspace, and going
 * further would mean versioning a parent's own parents — which is a push, and
 * theirs to make.
 */
export type PullScope =
    | { kind: PullScopeKind.PARENTS }
    | { kind: PullScopeKind.ALL }
    | { kind: PullScopeKind.ONE; workspace: WorkspacePath };

export enum VersionJobKind {
    PUSH = "push",
    PULL = "pull"
}

/** A document a run acts on, named as the run found it. */
export interface VersionJobDocument {
    workspace: WorkspacePath;
    /** Absent where Onshape would not say. */
    documentName?: string;
}

/** What one step of a run does to its document. */
export enum VersionTaskAction {
    VERSION = "version",
    REFERENCES = "references"
}

export enum VersionTaskState {
    PENDING = "pending",
    RUNNING = "running",
    DONE = "done",
    FAILED = "failed",
    /** Not tried, since what it needed from an earlier task failed. */
    SKIPPED = "skipped"
}

/** One step of a run, in the order the run takes them. */
export interface VersionTask extends VersionJobDocument {
    action: VersionTaskAction;
    state: VersionTaskState;
    /** Why it failed, written for the user. */
    reason?: string;
}

/** What a push or pull did — all of it, or as far as it got before it stopped. */
export interface VersionJobResult {
    /** Workspaces whose references were updated. */
    updatedWorkspaces: number;
    /** Tabs whose references were repointed. */
    updatedElements: number;
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
    kind?: VersionJobKind;
    /** Moves references onto versions that exist, and cuts none. */
    updateOnly?: boolean;
    /** What it was aimed at: the children pushed to, or the parents pulled from. */
    targets?: VersionJobDocument[];
    /** Its steps, each as far as it has got. */
    tasks?: VersionTask[];
    /**
     * What the run did. On a failure, what it had done before it stopped, which
     * is still in Onshape.
     */
    result?: VersionJobResult;
    /** Why the whole run stopped, when it did. Written for the user. */
    error?: string;
    /** When it ended, in epoch milliseconds. */
    finishedAt?: number;
}

/**
 * A run that has done nothing yet, which is also what one that found nothing to
 * do returns. A function, since a run adds to the one it is given.
 */
export function emptyJobResult(): VersionJobResult {
    return {
        updatedWorkspaces: 0,
        updatedElements: 0,
        createdVersions: 0
    };
}

/**
 * Where the client fetches a linked workspace's thumbnail. Built here so the
 * url the browser asks for is declared beside the route that answers it, the
 * way `features/thumbnails/keys.ts` does for a rendered one.
 */
export function workspaceThumbnailUrl(
    workspace: WorkspacePath,
    size: string
): string {
    const query = new URLSearchParams({
        documentId: workspace.documentId,
        instanceId: workspace.instanceId,
        size
    });
    return `/api/workspace-thumbnail?${query.toString()}`;
}

/** How long a version name may be, matching what Onshape accepts. */
export const MAX_VERSION_NAME_LENGTH = 256;

/**
 * The names Onshape's own version dialog offers, which a push with no name of
 * its own follows: the highest `V<n>` a document already has, plus one.
 */
export const VERSION_NAME_PATTERN = /^V(\d+)$/;

/**
 * The next `V<n>` after the names given, per document — so two documents in one
 * push each get their own number rather than sharing the higher one.
 */
export function nextVersionName(existingNames: string[]): string {
    let highest = 0;
    for (const name of existingNames) {
        const match = VERSION_NAME_PATTERN.exec(name.trim());
        if (match) {
            highest = Math.max(highest, Number.parseInt(match[1], 10));
        }
    }
    return `V${highest + 1}`;
}
