import { useMutation } from "@tanstack/react-query";
import {
    type FeedbackIn,
    type FeedbackOut
} from "@backend/features/feedback/contract";
import { apiPost } from "../../lib/api-client";
import { handleAppError } from "../../lib/errors";

const FEEDBACK_TOAST_ID = "send-feedback";

/** The form stays open on a failure, so nothing typed is lost. */
export function useSendFeedbackMutation() {
    return useMutation({
        mutationFn: (body: FeedbackIn) =>
            apiPost<FeedbackOut>("/feedback", { body }),
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
