import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { queryClient } from "../query-client";
import { ElementObj, ElementType, hasUserAccess } from "../api/models";
import { useMemo } from "react";
import { useSearch } from "@tanstack/react-router";
import { showErrorToast } from "../common/toaster";

export function useSetVisibilityMutation(
    mutationKey: string,
    elementIds: string[],
    isVisible: boolean
) {
    return useMutation({
        mutationKey: [mutationKey],
        mutationFn: async () => {
            if (!isVisible) {
                const result = window.confirm(
                    "You are about to hide one or more elements. This will also permanently remove them from all users' favorites. Are you sure?`"
                );
                if (!result) {
                    showErrorToast("Cancelled operation.");
                    return;
                }
            }
            return apiPost("/set-visibility", {
                body: {
                    elementIds,
                    isVisible
                }
            });
        },
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ["elements"] });
        }
    });
}

export function useIsAssemblyInPartStudio(elementType: ElementType): boolean {
    const search = useSearch({ from: "/app" });
    return useMemo(() => {
        return (
            elementType === ElementType.ASSEMBLY &&
            search.elementType == ElementType.PART_STUDIO
        );
    }, [elementType, search.elementType]);
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
