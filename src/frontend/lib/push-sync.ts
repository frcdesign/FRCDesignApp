/** Applies the server's pushes to the cache. Mounted once, by the app shell. */
import { useEffect, useRef } from "react";
import { type PushMessage, PushType } from "@backend/features/push/contract";
import { workspaceKey } from "@backend/features/version-manager/contract";
import { hasEditorAccess } from "@backend/features/auth/access-level";
import { useAccessData } from "../features/auth/access-level";
import { isRenderOf } from "../features/thumbnails/render-wait";
import { useLibraryId } from "./library";
import {
    connectPushes,
    subscribePushConnection,
    subscribePushes
} from "./push-socket";
import { useTargetWorkspace } from "./onshape-params";
import { queryClient } from "./query-client";
import { jobStatusQueryKey, versionJobQueryKey } from "./query-keys";
import { useRefreshLibrary } from "./refresh";

export function usePushSync(): void {
    const libraryId = useLibraryId();
    const workspace = useTargetWorkspace();
    const refreshLibrary = useRefreshLibrary();
    const { signedIn, currentAccessLevel } = useAccessData();
    // Non-editors would otherwise show spinners for work they can't see.
    const showsJobs = signedIn && hasEditorAccess(currentAccessLevel);
    const hasConnected = useRef(false);

    // Tagged with the workspace too, so a push or pull started in it reaches
    // everyone in that document and nobody else.
    const key = workspace && workspaceKey(workspace);
    useEffect(
        () => connectPushes({ libraryId, workspaceKey: key }),
        [libraryId, key]
    );

    useEffect(() => {
        const apply = (message: PushMessage) => {
            switch (message.type) {
                case PushType.JOBS:
                    if (showsJobs && message.libraryId === libraryId) {
                        queryClient.setQueryData(
                            jobStatusQueryKey(libraryId),
                            message.status
                        );
                    }
                    break;
                case PushType.LIBRARY:
                    if (message.libraryId === libraryId) {
                        void refreshLibrary();
                    }
                    break;
                case PushType.VERSION_JOB:
                    // Tagged to this workspace, so it is this page's run.
                    if (workspace) {
                        queryClient.setQueryData(
                            versionJobQueryKey(workspace),
                            message.status
                        );
                    }
                    break;
                case PushType.THUMBNAIL:
                    // Rows that took a miss; anything waiting on the render hears the push itself.
                    void queryClient.refetchQueries({
                        predicate: (query) => {
                            const [kind, url] = query.queryKey;
                            return (
                                kind === "storage-thumbnail" &&
                                typeof url === "string" &&
                                query.state.status === "error" &&
                                isRenderOf(url, message)
                            );
                        }
                    });
                    break;
            }
        };
        return subscribePushes(apply);
    }, [libraryId, refreshLibrary, showsJobs, workspace]);

    // Pushes during the outage are lost, so a reconnect refetches.
    useEffect(
        () =>
            subscribePushConnection((connected) => {
                if (!connected) {
                    return;
                }
                if (hasConnected.current) {
                    void refreshLibrary();
                    if (workspace) {
                        void queryClient.invalidateQueries({
                            queryKey: versionJobQueryKey(workspace)
                        });
                    }
                }
                hasConnected.current = true;
            }),
        [refreshLibrary, workspace]
    );
}
