import { useMutation } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { type ElementPath } from "@backend/lib/onshape/path";
import {
    type BoltHelperResult,
    type EdgeSelection
} from "@backend/features/bolt-helper/contract";
import { apiPost } from "../../lib/api-client";
import { getAppErrorHandler } from "../../lib/errors";
import { showLoadingToast, showSuccessToast } from "../../lib/notifications";

const TOAST_ID = "bolt-helper";

/** Mates the selected edges in the tab the app is open in. */
export function useBoltHelperMutation() {
    const search = useSearch({ from: "/app" });

    return useMutation({
        mutationKey: ["bolt-helper"],
        mutationFn: async (
            edges: EdgeSelection[]
        ): Promise<BoltHelperResult> => {
            // The tab worked in, sent whole so the instance type travels with
            // its id rather than being reassembled from the url.
            const targetPath: ElementPath = {
                documentId: search.documentId,
                instanceId: search.instanceId,
                instanceType: search.instanceType,
                elementId: search.elementId
            };

            showLoadingToast("Creating fasten mates...", TOAST_ID);
            return apiPost("/bolt-helper", { body: { targetPath, edges } });
        },
        onError: getAppErrorHandler(
            "Unexpectedly failed to create the fasten mates.",
            TOAST_ID
        ),
        onSuccess: (result) => {
            const count = result.featureIds.length;
            showSuccessToast(
                `Created ${count} fasten mate${count === 1 ? "" : "s"} in ${result.elementName}.`,
                TOAST_ID
            );
        }
    });
}
