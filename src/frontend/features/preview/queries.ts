/** Shows parts in Onshape's graphics window, through the preview extension. */
import {
    PREVIEW_SOURCE,
    previewMeshId,
    type PreviewPart
} from "@backend/features/previews/contract";
import { type UseQueryResult, useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { apiGetBytes } from "../../lib/api-client";
import { useOnshapeServer } from "../../lib/onshape-params";
import { previewMeshQueryKey } from "../../lib/query-keys";
import { postToPreviewExtension, usePreviewExtension } from "./extension";

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
 * or the caller unmounts. Nothing is fetched without the extension. Memoize
 * `parts`.
 */
export function usePartPreview(parts: PreviewPart[] | undefined) {
    const isReady = usePreviewExtension((state) => state.isReady);
    const server = useOnshapeServer();
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
            enabled: isReady,
            staleTime: Infinity,
            retry: false
        })),
        combine
    });
    const isShowing = useRef(false);

    useEffect(() => {
        if (!isReady || !server || isPending) {
            return;
        }
        const shown = (parts ?? []).filter((part) =>
            Object.hasOwn(meshes, previewMeshId(part))
        );
        if (shown.length === 0) {
            if (isShowing.current) {
                postToPreviewExtension(server, {
                    source: PREVIEW_SOURCE,
                    type: "clear"
                });
                isShowing.current = false;
            }
            return;
        }
        postToPreviewExtension(server, {
            source: PREVIEW_SOURCE,
            type: "show",
            meshes,
            parts: shown.map((part) => ({
                mesh: previewMeshId(part),
                transform: part.transform
            }))
        });
        isShowing.current = true;
    }, [isReady, server, isPending, meshes, parts]);

    useEffect(
        () => () => {
            if (server && isShowing.current) {
                postToPreviewExtension(server, {
                    source: PREVIEW_SOURCE,
                    type: "clear"
                });
                isShowing.current = false;
            }
        },
        [server]
    );
}
