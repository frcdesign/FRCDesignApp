import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { ElementObj } from "../api-utils/client-models";
import { hasUserAccess } from "../../shared/types";
import { useMemo } from "react";
import { useRouter, useSearch } from "@tanstack/react-router";
import { showErrorToast, showSuccessToast } from "../common/toaster";
import { toLibraryPath, useLibrary } from "../api-utils/library";
import { getAppErrorHandler } from "../api-utils/errors";
import { libraryQueryMatchKey } from "../queries";
import {
  ElementPath,
  InstancePath,
  isElementPath,
  toElementApiPath,
  toInstanceApiPath,
} from "../../shared/path";

export function useSetVisibilityMutation(
  documentId: string,
  elementIds: string[],
  isVisible: boolean,
) {
  const library = useLibrary();
  const router = useRouter();

  return useMutation({
    mutationKey: ["set-element-visibility"],
    mutationFn: async () => {
      if (!isVisible) {
        const result = window.confirm(
          "You are about to hide one or more elements. This will also permanently remove them from all users' favorites. Are you sure?",
        );
        if (!result) {
          showErrorToast("Cancelled hide operation.");
          return;
        }
      }
      return apiPost("/set-element-visibility" + toLibraryPath(library), {
        body: {
          documentId,
          elementIds,
          isVisible,
        },
      });
    },
    onError: getAppErrorHandler("Unexpectedly failed to modify visibility."),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: libraryQueryMatchKey() });
      router.invalidate();
    },
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

export function useReloadThumbnailMutation(path: InstancePath | ElementPath) {
  const library = useLibrary();
  const router = useRouter();

  const apiPath = isElementPath(path)
    ? toElementApiPath(path)
    : toInstanceApiPath(path);

  return useMutation({
    mutationKey: ["thumbnail", "reload", apiPath],
    mutationFn: async () => {
      // Every element path is an instance path, but instance paths are not element paths
      return apiPost("/reload-thumbnail" + toLibraryPath(library) + apiPath);
    },
    onError: getAppErrorHandler("Unexpectedly failed to reload thumbnail."),
    onSuccess: () => {
      showSuccessToast("Successfully reloaded thumbnail.");
    },
    onSettled: async () => {
      // Reload the library so we get up to date urls
      await queryClient.invalidateQueries({
        queryKey: libraryQueryMatchKey(),
      });
      router.invalidate();
    },
  });
}
