import { useMutation } from "@tanstack/react-query";
import {
    type QuickFastenerIn,
    type QuickFastenerInsertOut,
    type QuickFastenerPlan
} from "@backend/features/quick-fastener/contract";
import { apiPost } from "../../lib/api-client";
import { getAppErrorHandler } from "../../lib/errors";
import { showLoadingToast, showSuccessToast } from "../../lib/notifications";
import { plural } from "../../lib/plural";

const INSERT_TOAST = "quick-fastener-insert";

/** The fastener each picked hole would get; nothing changes in Onshape. */
export function usePlanMutation() {
    return useMutation({
        mutationKey: ["quick-fastener-plan"],
        mutationFn: (body: QuickFastenerIn) =>
            apiPost<QuickFastenerPlan>("/quick-fastener/plan", { body }),
        onError: getAppErrorHandler("Unexpectedly failed to check the holes.")
    });
}

export function useInsertMutation() {
    return useMutation({
        mutationKey: ["quick-fastener-insert"],
        mutationFn: (body: QuickFastenerIn) => {
            showLoadingToast("Inserting fasteners...", INSERT_TOAST);
            return apiPost<QuickFastenerInsertOut>("/quick-fastener/insert", {
                body
            });
        },
        onSuccess: ({ inserted }) =>
            showSuccessToast(
                inserted === 0
                    ? "Nothing to insert."
                    : `Inserted ${plural(inserted, "part")}.`,
                INSERT_TOAST
            ),
        onError: getAppErrorHandler(
            "Unexpectedly failed to insert fasteners.",
            INSERT_TOAST
        )
    });
}
