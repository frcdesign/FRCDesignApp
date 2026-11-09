import {
    queryOptions,
    useMutation,
    useQueryClient
} from "@tanstack/react-query";
import type {
    OnshapeCallBody,
    OnshapeCallResult,
    RegisterProbeBody,
    RegisterProbeOut,
    WebhookProbeOut
} from "@backend/features/testbench/contract";
import { apiDelete, apiGet, apiPost } from "../../lib/api-client";

/** One Onshape call, made as the owner by the Worker. */
export function callOnshape(
    body: OnshapeCallBody,
    signal?: AbortSignal
): Promise<OnshapeCallResult> {
    return apiPost("/testbench/onshape", { body, signal });
}

export function useOnshapeCallMutation() {
    return useMutation({
        mutationFn: (body: OnshapeCallBody) => callOnshape(body)
    });
}

const PROBES_POLL_MS = 3000;

export const webhookProbesQuery = queryOptions<WebhookProbeOut[]>({
    queryKey: ["testbench", "webhooks"],
    queryFn: () => apiGet("/testbench/webhooks"),
    retry: false,
    refetchInterval: PROBES_POLL_MS
});

export function useRegisterProbeMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: RegisterProbeBody) =>
            apiPost<RegisterProbeOut>("/testbench/webhooks", { body }),
        onSettled: () =>
            queryClient.invalidateQueries({
                queryKey: webhookProbesQuery.queryKey
            })
    });
}

export function useDeleteProbeMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (probeId: string) =>
            apiDelete(`/testbench/webhooks/${encodeURIComponent(probeId)}`),
        onSettled: () =>
            queryClient.invalidateQueries({
                queryKey: webhookProbesQuery.queryKey
            })
    });
}
