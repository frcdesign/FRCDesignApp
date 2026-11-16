/** Shows parts in Onshape's graphics window, through the FRCDesignApp Companion. */
import { COMPANION_SOURCE } from "@backend/features/companion/contract";
import {
    previewMeshId,
    type PreviewPart
} from "@backend/features/previews/contract";
import { type UseQueryResult, useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { apiGetBytes } from "../../lib/api-client";
import { sendWorkingSpinnerMessage } from "../../lib/messages";
import { useOnshapeServer, useTargetElement } from "../../lib/onshape-params";
import { previewMeshQueryKey } from "../../lib/query-keys";
import { postToCompanion, useCompanion } from "../companion/connection";

interface PreviewMeshes {
    /** Each mesh fetched, by id; a mesh that failed is left out, and its parts with it. */
    meshes: Record<string, ArrayBuffer>;
    isPending: boolean;
}

function uniqueMeshes(parts: PreviewPart[]): PreviewPart[] {
    const byId = new Map(parts.map((part) => [previewMeshId(part), part]));
    return [...byId.values()];
}

/**
 * Previews `parts` while they're set, and clears the preview when they aren't
 * or the caller unmounts. Onshape's working spinner turns while `isUpdating`
 * or meshes are coming. Nothing is fetched without the Companion. Memoize
 * `parts`.
 */
export function usePartPreview(
    parts: PreviewPart[] | undefined,
    isUpdating = false
) {
    const isConnected = useCompanion((state) => state.isConnected);
    const server = useOnshapeServer();
    const target = useTargetElement();
    const unique = useMemo(() => uniqueMeshes(parts ?? []), [parts]);
    const ids = useMemo(() => unique.map(previewMeshId), [unique]);
    const combine = useCallback(
        (results: UseQueryResult<ArrayBuffer>[]): PreviewMeshes => {
            const meshes: Record<string, ArrayBuffer> = {};
            results.forEach((result, index) => {
                if (result.data) {
                    meshes[ids[index]] = result.data;
                }
            });
            return {
                meshes,
                isPending: results.some((result) => result.isPending)
            };
        },
        [ids]
    );
    const { meshes, isPending } = useQueries({
        queries: unique.map((part, index) => ({
            queryKey: previewMeshQueryKey(ids[index]),
            queryFn: ({ signal }: { signal: AbortSignal }) =>
                apiGetBytes(`/preview-mesh/insertable/${part.insertableId}`, {
                    query: {
                        microversionId: part.microversionId,
                        configuration: part.configuration
                    },
                    cacheId: part.microversionId,
                    signal
                }),
            enabled: isConnected,
            staleTime: Infinity,
            retry: false
        })),
        combine
    });
    const isShowing = useRef(false);
    const isWorking = isConnected && (isUpdating || isPending);

    useEffect(() => {
        if (!isConnected || !server || isPending) {
            return;
        }
        const shown = (parts ?? []).filter((part) =>
            Object.hasOwn(meshes, previewMeshId(part))
        );
        if (shown.length === 0) {
            if (isShowing.current) {
                postToCompanion(server, {
                    source: COMPANION_SOURCE,
                    type: "clear-preview"
                });
                isShowing.current = false;
            }
            return;
        }
        postToCompanion(server, {
            source: COMPANION_SOURCE,
            type: "show-preview",
            meshes,
            parts: shown.map((part) => ({
                mesh: previewMeshId(part),
                transform: part.transform
            }))
        });
        isShowing.current = true;
    }, [isConnected, server, isPending, meshes, parts]);

    useEffect(() => {
        if (!target || !isWorking) {
            return;
        }
        sendWorkingSpinnerMessage(target, true);
        return () => {
            sendWorkingSpinnerMessage(target, false);
        };
    }, [target, isWorking]);

    useEffect(
        () => () => {
            if (server && isShowing.current) {
                postToCompanion(server, {
                    source: COMPANION_SOURCE,
                    type: "clear-preview"
                });
                isShowing.current = false;
            }
        },
        [server]
    );
}
