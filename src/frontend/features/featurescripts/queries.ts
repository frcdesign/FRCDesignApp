/** The released FeatureScripts, and adding one to the open Part Studio. */
import {
    keepPreviousData,
    queryOptions,
    skipToken,
    useMutation,
    useQuery,
    useQueryClient
} from "@tanstack/react-query";
import {
    type AddFeatureScriptIn,
    type AddFeatureScriptOut,
    type FeatureScriptFavoritesOut,
    type FeatureScriptOut,
    type FeatureScriptsOut,
    type FeatureScriptsVersionOut
} from "@backend/features/featurescripts/contract";
import { AccessLevel } from "@backend/features/auth/access-level";
import { ElementType } from "@backend/lib/onshape/element-type";
import { apiDelete, apiGet, apiPost } from "../../lib/api-client";
import { handleAppError } from "../../lib/errors";
import { sendOpenFeatureMessage } from "../../lib/messages";
import { showLoadingToast, showSuccessToast } from "../../lib/notifications";
import { useOnshapeOrigin, useTargetElement } from "../../lib/onshape-params";
import { makeUrl } from "../../lib/url";
import {
    featureScriptFavoritesQueryKey,
    featureScriptsQueryKey,
    featureScriptsVersionQueryKey
} from "../../lib/query-keys";
import { useAccessData, useIsSignedIn } from "../auth/access-level";
import { m } from "../../paraglide/messages";

/** The cache version keying `/featurescripts?v=`; bumped only by a load. */
export function getFeatureScriptsVersionQuery() {
    return queryOptions<number>({
        queryKey: featureScriptsVersionQueryKey(),
        queryFn: () =>
            apiGet<FeatureScriptsVersionOut>("/featurescripts-version").then(
                (result) => result.version
            ),
        staleTime: Infinity
    });
}

export function getFeatureScriptsQuery(cacheVersion: number) {
    return queryOptions<FeatureScriptsOut>({
        queryKey: featureScriptsQueryKey(cacheVersion),
        queryFn: () => apiGet("/featurescripts", { cacheId: cacheVersion }),
        placeholderData: keepPreviousData,
        staleTime: Infinity
    });
}

export function useFeatureScriptsQuery() {
    // Loaded by the route before anything reading this renders.
    const version = useQuery(getFeatureScriptsVersionQuery());
    return useQuery(getFeatureScriptsQuery(version.data ?? 0));
}

/** The example in the loaded version, when the feature has one. */
export function useExampleUrl(feature: FeatureScriptOut): string | undefined {
    const origin = useOnshapeOrigin();
    const { data } = useFeatureScriptsQuery();
    if (!feature.exampleElementId || !data?.documentId || !data.versionId) {
        return undefined;
    }
    return makeUrl(origin, {
        documentId: data.documentId,
        instanceType: "v",
        instanceId: data.versionId,
        elementId: feature.exampleElementId
    });
}

/** Every feature but the hidden, which the owner sees too, to fix them. */
export function useIsOwner(): boolean {
    return useAccessData().currentAccessLevel === AccessLevel.OWNER;
}

/** Whether adding is offered here at all, and if it is, why it is disabled. */
export type AddAvailability =
    | { offered: false }
    | { offered: true; disabledReason?: string };

/**
 * Not offered standalone, where there is nothing to add to, as an insert
 * isn't; disabled in an assembly, which takes no Part Studio feature.
 */
export function useAddAvailability(): AddAvailability {
    const target = useTargetElement();
    if (!target) {
        return { offered: false };
    }
    return target.elementType === ElementType.PART_STUDIO
        ? { offered: true }
        : { offered: true, disabledReason: m.featureScriptsAddInAssembly() };
}

/** Adds the feature at its defaults, then opens its dialog in Onshape to finish it. */
export function useAddFeatureScriptMutation(feature: FeatureScriptOut) {
    const target = useTargetElement();
    const toastId = "add-featurescript-" + feature.id;

    return useMutation({
        mutationKey: ["add-featurescript", feature.id],
        mutationFn: () => {
            // The button doesn't enable without a Part Studio to add to.
            if (!target) {
                throw new Error("Nothing to add to.");
            }
            const targetPath = {
                documentId: target.documentId,
                instanceId: target.instanceId,
                instanceType: target.instanceType,
                elementId: target.elementId
            };
            showLoadingToast(
                m.featureScriptsAdding({ name: feature.name }),
                toastId
            );
            return apiPost<AddFeatureScriptOut>(
                `/featurescripts/${feature.id}/add`,
                { body: { targetPath } satisfies AddFeatureScriptIn }
            );
        },
        onError: (error) =>
            handleAppError(
                error,
                m.featureScriptsAddFailed({ name: feature.name }),
                toastId
            ),
        onSuccess: (result) => {
            if (target && result.featureId !== undefined) {
                sendOpenFeatureMessage(target, result.featureId);
            }
            showSuccessToast(
                m.featureScriptsAdded({ name: feature.name }),
                toastId
            );
        }
    });
}

/** The caller's favorites; nothing to ask for signed out, since they're kept per account. */
export function useFeatureScriptFavoritesQuery() {
    const isSignedIn = useIsSignedIn();
    return useQuery<FeatureScriptFavoritesOut>({
        queryKey: featureScriptFavoritesQueryKey(),
        queryFn: isSignedIn
            ? () => apiGet("/featurescripts/favorites")
            : skipToken
    });
}

export function useIsFeatureScriptFavorite(featureId: string): boolean {
    const { data } = useFeatureScriptFavoritesQuery();
    return data?.featureScriptIds.includes(featureId) ?? false;
}

/** Shown at once, and put right by the refetch either way. */
export function useToggleFavoriteMutation(feature: FeatureScriptOut) {
    const queryClient = useQueryClient();
    const queryKey = featureScriptFavoritesQueryKey();
    return useMutation<unknown, Error, boolean>({
        mutationKey: ["favorite-featurescript", feature.id],
        mutationFn: (favorite) => {
            const path = `/featurescripts/${feature.id}/favorite`;
            return favorite ? apiPost(path) : apiDelete(path);
        },
        onMutate: async (favorite) => {
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData<FeatureScriptFavoritesOut>(
                queryKey,
                (data) =>
                    data && {
                        featureScriptIds: favorite
                            ? [...data.featureScriptIds, feature.id]
                            : data.featureScriptIds.filter(
                                  (id) => id !== feature.id
                              )
                    }
            );
        },
        onError: (error, favorite) =>
            handleAppError(
                error,
                favorite
                    ? m.featureScriptsFavoriteFailed({ name: feature.name })
                    : m.featureScriptsUnfavoriteFailed({ name: feature.name })
            ),
        onSettled: () => queryClient.invalidateQueries({ queryKey })
    });
}
