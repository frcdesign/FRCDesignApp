import { useMutation } from "@tanstack/react-query";
import {
    type FeedbackIn,
    type FeedbackOut
} from "@backend/features/feedback/contract";
import { apiPost } from "../../lib/api-client";
import { handleAppError } from "../../lib/errors";
import { showSuccessToast } from "../../lib/notifications";

const FEEDBACK_TOAST_ID = "send-feedback";

/** The form stays open on a failure, so nothing typed is lost. */
export function useSendFeedbackMutation(onSent: () => void) {
    return useMutation({
        mutationFn: (body: FeedbackIn) =>
            apiPost<FeedbackOut>("/feedback", { body }),
        onSuccess: () => {
            showSuccessToast("Report sent. Thank you!", FEEDBACK_TOAST_ID);
            onSent();
        },
        onError: (error) =>
            // No Report button: a report that can't be sent can't report itself.
            handleAppError(
                error,
                "Failed to send the report.",
                FEEDBACK_TOAST_ID,
                false
            )
    });
}
