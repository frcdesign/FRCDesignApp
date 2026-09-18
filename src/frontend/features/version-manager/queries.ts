import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import {
    LinkDirection,
    type PullScope,
    type PushScope,
    VersionJobState,
    type VersionJobResult,
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
    versionJobQueryKey,
    workspaceLinksQueryKey
} from "../../lib/query-keys";
import { useIsSignedIn } from "../auth/access-level";

/** How often a running push or pull is asked whether it has finished. */
const JOB_POLL_MS = 2000;

function toWorkspaceQuery(workspace: WorkspacePath) {
    return {
        documentId: workspace.documentId,
        instanceId: workspace.instanceId
    };
}

/**
 * The workspaces linked to this one. Reading them means asking Onshape for each
 * one's name and the caller's permissions, so it stays idle while signed out
 * rather than answering 401.
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
        refetchInterval: false
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
    /**
     * Absent for the ordinary case, which is most of them: the server then
     * names each version as Onshape's own dialog would, V<n> after the highest
     * the document already has.
     */
    name?: string;
    description?: string;
    scope: PushScope;
}

/**
 * Starts a push. The work runs in a workflow, so what comes back is the run's
 * id; {@link useVersionJobQuery} is what says how it went.
 */
export function usePushVersionMutation(workspace: WorkspacePath) {
    return useMutation({
        mutationKey: ["push-version", workspace],
        mutationFn: ({ name, description, scope }: PushVersionArgs) =>
            apiPost<{ jobId: string }>("/push-version", {
                // An empty name is left off rather than sent: the name is what
                // the server defaults, and "" is not a name.
                body: {
                    workspace,
                    name: name?.trim() || undefined,
                    description,
                    scope
                }
            }),
        onSuccess: ({ jobId }) => adoptJob(workspace, jobId),
        onError: getAppErrorHandler("Unexpectedly failed to push the version.")
    });
}

export function usePullReferencesMutation(workspace: WorkspacePath) {
    return useMutation({
        mutationKey: ["pull-references", workspace],
        mutationFn: (scope: PullScope) =>
            apiPost<{ jobId: string }>("/pull-references", {
                body: { workspace, scope }
            }),
        onSuccess: ({ jobId }) => adoptJob(workspace, jobId),
        onError: getAppErrorHandler(
            "Unexpectedly failed to update the references."
        )
    });
}

/**
 * Shows the run as running straight away, rather than leaving the page idle
 * until the first poll comes back.
 */
function adoptJob(workspace: WorkspacePath, jobId: string): void {
    queryClient.setQueryData<VersionJobStatus>(versionJobQueryKey(workspace), {
        state: VersionJobState.RUNNING,
        jobId
    });
}

/**
 * The run this workspace last started: polled while it is live, and left alone
 * once it is not. Asked without a run in hand too, so a panel that was closed
 * and reopened finds one still going.
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
        refetchInterval: (query) =>
            query.state.data?.state === VersionJobState.RUNNING
                ? JOB_POLL_MS
                : false
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

/** What a finished run did, in one line. */
export function describeJobResult(result: VersionJobResult): string {
    const parts: string[] = [];
    // A pull cuts none, so the count only earns a clause when there is one.
    if (result.createdVersions > 0) {
        parts.push(`Created ${plural(result.createdVersions, "version")}`);
    }
    parts.push(
        result.updatedElements === 0
            ? "nothing needed updating"
            : `updated ${plural(result.updatedElements, "tab")} in ${plural(
                  result.updatedWorkspaces,
                  "workspace"
              )}`
    );
    if (result.failedElements > 0) {
        parts.push(
            `${plural(result.failedElements, "tab")} could not be updated`
        );
    }
    const sentence = parts.join(", ") + ".";
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
