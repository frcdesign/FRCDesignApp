import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { queryClient } from "../query-client";
import { ElementObj, hasUserAccess } from "../api/models";
import { useMemo } from "react";
import { useSearch } from "@tanstack/react-router";
import { showErrorToast } from "../common/toaster";
import { toLibraryPath, useLibrary } from "../api/library";
import { getAppErrorHandler } from "../api/errors";
import { libraryQueryMatchKey } from "../queries";
import { router } from "../router";

export function useSetVisibilityMutation(
    documentId: string,
    elementIds: string[],
    isVisible: boolean
) {
    const library = useLibrary();
    return useMutation({
        mutationKey: ["set-visibility"],
        mutationFn: async () => {
            if (!isVisible) {
                const result = window.confirm(
                    "You are about to hide one or more elements. This will also permanently remove them from all users' favorites. Are you sure?"
                );
                if (!result) {
                    showErrorToast("Cancelled hide operation.");
                    return;
                }
            }
            return apiPost("/set-visibility" + toLibraryPath(library), {
                body: {
                    documentId,
                    elementIds,
                    isVisible
                }
            });
        },
        onError: getAppErrorHandler(
            "Unexpectedly failed to modify visibility."
        ),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: libraryQueryMatchKey() });
            router.invalidate();
        }
    });
}

/**
 * Returns true if the current element should be hidden from the current user.
 * Note this is different from whether the element is visible since admins can always see hidden elements.
 */
export function useIsElementHidden(element: ElementObj): boolean {
    const search = useSearch({ from: "/app" });
    return useMemo(() => {
        return !element.isVisible && hasUserAccess(search.currentAccessLevel);
    }, [element.isVisible, search.currentAccessLevel]);
}
