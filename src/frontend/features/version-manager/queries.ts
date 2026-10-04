import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import {
    type AddLinkOut,
    LinkDirection,
    type PullScope,
    type PushScope,
    VersionJobState,
    type VersionJobStatus,
    type WorkspaceLinksData,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { apiDelete, apiGet, apiPost } from "../../lib/api-client";
import { toWorkspaceLinkPath } from "../../lib/api-paths";
import { getAppErrorHandler } from "../../lib/errors";
import { showSuccessToast } from "../../lib/notifications";
import { queryClient } from "../../lib/query-client";
import {
    nextVersionNameQueryKey,
    versionJobQueryKey,
    workspaceLinksQueryKey
} from "../../lib/query-keys";
import { useIsSignedIn } from "../auth/access-level";
import { Hint } from "@backend/features/hints/contract";
import { markHintSeen } from "../hints/queries";
import { documentLabel } from "./document-label";

/** A GET about the workspace; idle without one, or signed out. */
function useWorkspaceQuery<T>(
    queryKey: unknown[],
    path: string,
    workspace: WorkspacePath | undefined,
    staleTime?: number
) {
    const isSignedIn = useIsSignedIn();
    return useQuery<T>({
        queryKey,
        queryFn:
            workspace && isSignedIn
                ? () =>
                      apiGet(path, {
                          query: {
                              documentId: workspace.documentId,
                              instanceId: workspace.instanceId
                          }
                      })
                : skipToken,
        staleTime
    });
}

/** Each read asks Onshape about every link, so it is refreshed only when something changes them. */
export function useWorkspaceLinksQuery(workspace: WorkspacePath | undefined) {
    return useWorkspaceQuery<WorkspaceLinksData>(
        workspaceLinksQueryKey(workspace),
        "/workspace-links",
        workspace,
        Infinity
    );
}

async function refreshLinks(workspace: WorkspacePath): Promise<void> {
    await queryClient.invalidateQueries({
        queryKey: workspaceLinksQueryKey(workspace)
    });
}

/** Reads the linked documents again from Onshape, past what the server cached of them. */
export function useRefreshVersionManagerMutation(
    workspace: WorkspacePath | undefined
) {
    return useMutation({
        mutationKey: ["refresh-version-manager", workspace],
        mutationFn: async () => {
            if (!workspace) {
                return;
            }
            await apiPost("/workspace-links/refresh", { body: { workspace } });
            await Promise.all(
                [
                    workspaceLinksQueryKey(workspace),
                    versionJobQueryKey(workspace),
                    nextVersionNameQueryKey(workspace)
                ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
            );
        },
        onSuccess: () => showSuccessToast("Refreshed linked documents."),
        onError: getAppErrorHandler("Unexpectedly failed to refresh.")
    });
}

interface AddLinkArgs {
    linked: WorkspacePath;
    direction: LinkDirection;
}

export function useAddLinkMutation(workspace: WorkspacePath) {
    return useMutation({
        mutationKey: ["add-workspace-link", workspace],
        mutationFn: ({ linked, direction }: AddLinkArgs) =>
            apiPost<AddLinkOut>("/workspace-links", {
                body: { workspace, linked, direction }
            }),
        onSuccess: async (linked) => {
            markHintSeen(Hint.USED_VERSION_MANAGER);
            showSuccessToast(`Successfully linked ${linkedName(linked)}.`);
            await refreshLinks(workspace);
        },
        onError: getAppErrorHandler("Unexpectedly failed to add the link.")
    });
}

/** "Document - Workspace", or the document alone where Onshape named no workspace. */
function linkedName(linked: AddLinkOut): string {
    const document = documentLabel(linked.documentName);
    return linked.workspaceName
        ? `${document} - ${linked.workspaceName}`
        : document;
}

interface MoveLinkArgs {
    linkId: string;
    /** What the other end should be once the move is done. */
    direction: LinkDirection;
}

/** Turns a link around, for one filed the wrong way up. */
export function useMoveLinkMutation(workspace: WorkspacePath) {
    return useMutation({
        mutationKey: ["move-workspace-link", workspace],
        mutationFn: ({ linkId, direction }: MoveLinkArgs) =>
            apiPost<{ success: boolean }>(
                toWorkspaceLinkPath(linkId) + "/move",
                { body: { workspace, direction } }
            ),
        onSuccess: async () => {
            showSuccessToast("Switched the link.");
            await refreshLinks(workspace);
        },
        onError: getAppErrorHandler("Unexpectedly failed to switch the link.")
    });
}

export function useRemoveLinkMutation(workspace: WorkspacePath) {
    return useMutation({
        mutationKey: ["remove-workspace-link", workspace],
        mutationFn: (linkId: string) =>
            apiDelete<{ success: boolean }>(toWorkspaceLinkPath(linkId)),
        onSuccess: async () => {
            showSuccessToast("Removed the link.");
            await refreshLinks(workspace);
        },
        onError: getAppErrorHandler("Unexpectedly failed to remove the link.")
    });
}

interface RunArgs<Scope> {
    /** Absent or blank, each version is named as Onshape's own dialog would. */
    name?: string;
    description?: string;
    scope: Scope;
    /** Moves references onto versions that exist, cutting none. */
    updateOnly?: boolean;
}

/**
 * Starts a push or a pull. The work runs in a workflow, so what comes back is
 * the run as it starts; {@link useVersionJobQuery} says how it goes.
 */
function useRunMutation<Scope>(
    workspace: WorkspacePath,
    path: "/push-version" | "/pull-references",
    failure: string
) {
    return useMutation({
        mutationKey: [path, workspace],
        mutationFn: ({ name, ...args }: RunArgs<Scope>) =>
            apiPost<VersionJobStatus>(path, {
                body: { workspace, name: name?.trim() || undefined, ...args }
            }),
        onSuccess: (status) => adoptJob(workspace, status),
        onError: getAppErrorHandler(failure)
    });
}

export function usePushVersionMutation(workspace: WorkspacePath) {
    return useRunMutation<PushScope>(
        workspace,
        "/push-version",
        "Unexpectedly failed to push the version."
    );
}

export function usePullReferencesMutation(workspace: WorkspacePath) {
    return useRunMutation<PullScope>(
        workspace,
        "/pull-references",
        "Unexpectedly failed to pull."
    );
}

/** Shows the run going straight away, before the socket says so. */
function adoptJob(workspace: WorkspacePath, started: VersionJobStatus): void {
    markHintSeen(Hint.USED_VERSION_MANAGER);
    // The socket can have brought this run's first progress already.
    queryClient.setQueryData<VersionJobStatus>(
        versionJobQueryKey(workspace),
        (current) => (current?.jobId === started.jobId ? current : started)
    );
}

/**
 * The run this workspace last started. Refreshed when the socket says it moved
 * on, and after a reconnect; nothing polls.
 */
export function useVersionJobQuery(workspace: WorkspacePath | undefined) {
    return useWorkspaceQuery<VersionJobStatus>(
        versionJobQueryKey(workspace),
        "/version-job",
        workspace,
        Infinity
    );
}

/** The name a run would give a version it cuts here, which the forms offer. */
export function useNextVersionNameQuery(workspace: WorkspacePath | undefined) {
    return useWorkspaceQuery<{ name: string }>(
        nextVersionNameQueryKey(workspace),
        "/next-version-name",
        workspace
    );
}

/** Whether a run started from this workspace is still going. */
export function useIsVersionJobRunning(
    workspace: WorkspacePath | undefined
): boolean {
    return (
        useVersionJobQuery(workspace).data?.state === VersionJobState.RUNNING
    );
}
