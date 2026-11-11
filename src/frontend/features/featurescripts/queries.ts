/** The released FeatureScripts, and adding one to the open Part Studio. */
import {
    keepPreviousData,
    queryOptions,
    useMutation,
    useQuery
} from "@tanstack/react-query";
import {
    type AddFeatureScriptIn,
    type AddFeatureScriptOut,
    type FeatureScriptOut,
    type FeatureScriptsOut,
    type FeatureScriptsVersionOut
} from "@backend/features/featurescripts/contract";
import { AccessLevel } from "@backend/features/auth/access-level";
import { ElementType } from "@backend/lib/onshape/element-type";
import { apiGet, apiPost } from "../../lib/api-client";
import { handleAppError } from "../../lib/errors";
import { sendOpenFeatureMessage } from "../../lib/messages";
import { showLoadingToast, showSuccessToast } from "../../lib/notifications";
import { useOnshapeOrigin, useTargetElement } from "../../lib/onshape-params";
import { makeUrl } from "../../lib/url";
import {
    featureScriptsQueryKey,
    featureScriptsVersionQueryKey
} from "../../lib/query-keys";
import { useAccessData } from "../auth/access-level";
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

/** Why a feature can't be added here, or undefined when it can. */
export function useCannotAddReason(): string | undefined {
    const target = useTargetElement();
    return target?.elementType === ElementType.PART_STUDIO
        ? undefined
        : m.featureScriptsAddNeedsPartStudio();
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
