import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../../lib/api-client";
import { getAppErrorHandler } from "../../lib/errors";
import { showInfoToast } from "../../lib/notifications";

/** Points the owner's company's Onshape webhooks at this deployment. */
export function useRegisterWebhooksMutation() {
    return useMutation({
        mutationKey: ["register-webhooks"],
        mutationFn: () => apiPost("/webhooks/register"),
        onError: getAppErrorHandler("Failed to register Onshape webhooks!"),
        onSuccess: () => showInfoToast("Onshape webhooks registered.")
    });
}
