import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import {
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

function toWorkspaceQuery(workspace: WorkspacePath) {
    return {
        documentId: workspace.documentId,
        instanceId: workspace.instanceId
    };
}

/**
 * The workspaces linked to this one. Each read asks Onshape about every link,
 * so it is refreshed only when something changes them.
 */
export function useWorkspaceLinksQuery(workspace: WorkspacePath | undefined) {
    const isSignedIn = useIsSignedIn();
    return useQuery<WorkspaceLinksData>({
        queryKey: workspaceLinksQueryKey(workspace),
        queryFn:
            workspace && isSignedIn
                ? () =>
                      apiGet("/workspace-links", {
                          query: toWorkspaceQuery(workspace)
                      })
                : skipToken,
        staleTime: Infinity
    });
}

async function refreshLinks(workspace: WorkspacePath): Promise<void> {
    await queryClient.invalidateQueries({
        queryKey: workspaceLinksQueryKey(workspace)
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
            apiPost<{ success: boolean }>("/workspace-links", {
                body: { workspace, linked, direction }
            }),
        onSuccess: async () => {
            showSuccessToast("Linked the workspace.");
            await refreshLinks(workspace);
        },
        onError: getAppErrorHandler("Unexpectedly failed to add the link.")
    });
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

export interface PushVersionArgs {
    /** Absent or blank, each version is named as Onshape's own dialog would. */
    name?: string;
    description?: string;
    scope: PushScope;
    /** Moves the children onto this document's newest version, cutting none. */
    updateOnly?: boolean;
}

/**
 * Starts a push. The work runs in a workflow, so what comes back is the run
 * as it starts; {@link useVersionJobQuery} is what says how it goes.
 */
export function usePushVersionMutation(workspace: WorkspacePath) {
    return useMutation({
        mutationKey: ["push-version", workspace],
        mutationFn: ({
            name,
            description,
            scope,
            updateOnly
        }: PushVersionArgs) =>
            apiPost<VersionJobStatus>("/push-version", {
                body: {
                    workspace,
                    name: name?.trim() || undefined,
                    description,
                    scope,
                    updateOnly
                }
            }),
        onSuccess: (status) => adoptJob(workspace, status),
        onError: getAppErrorHandler("Unexpectedly failed to push the version.")
    });
}

export interface PullReferencesArgs {
    /** Names the version cut in each parent; see {@link PushVersionArgs.name}. */
    name?: string;
    description?: string;
    scope: PullScope;
    /** Moves onto the parents' newest versions, cutting none. */
    updateOnly?: boolean;
}

export function usePullReferencesMutation(workspace: WorkspacePath) {
    return useMutation({
        mutationKey: ["pull-references", workspace],
        mutationFn: ({
            name,
            description,
            scope,
            updateOnly
        }: PullReferencesArgs) =>
            apiPost<VersionJobStatus>("/pull-references", {
                body: {
                    workspace,
                    name: name?.trim() || undefined,
                    description,
                    scope,
                    updateOnly
                }
            }),
        onSuccess: (status) => adoptJob(workspace, status),
        onError: getAppErrorHandler("Unexpectedly failed to pull.")
    });
}

/** Shows the run going straight away, before the socket says so. */
function adoptJob(workspace: WorkspacePath, started: VersionJobStatus): void {
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
    const isSignedIn = useIsSignedIn();
    return useQuery<VersionJobStatus>({
        queryKey: versionJobQueryKey(workspace),
        queryFn:
            workspace && isSignedIn
                ? () =>
                      apiGet("/version-job", {
                          query: toWorkspaceQuery(workspace)
                      })
                : skipToken,
        staleTime: Infinity
    });
}

/** The name a run would give a version it cuts here, which the forms offer. */
export function useNextVersionNameQuery(workspace: WorkspacePath | undefined) {
    const isSignedIn = useIsSignedIn();
    return useQuery<{ name: string }>({
        queryKey: nextVersionNameQueryKey(workspace),
        queryFn:
            workspace && isSignedIn
                ? () =>
                      apiGet("/next-version-name", {
                          query: toWorkspaceQuery(workspace)
                      })
                : skipToken
    });
}

/** Whether a run started from this workspace is still going. */
export function useIsVersionJobRunning(
    workspace: WorkspacePath | undefined
): boolean {
    return (
        useVersionJobQuery(workspace).data?.state === VersionJobState.RUNNING
    );
}
