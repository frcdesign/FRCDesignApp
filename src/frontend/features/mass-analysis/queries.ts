import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import {
    type MassReportOut,
    type PartPropertiesIn
} from "@backend/features/mass-analysis/contract";
import { type ElementPath } from "@backend/lib/onshape/path";
import { apiGet, apiPost } from "../../lib/api-client";
import { getAppErrorHandler } from "../../lib/errors";
import { queryClient } from "../../lib/query-client";
import { massReportQueryKey } from "../../lib/query-keys";
import { useIsSignedIn } from "../auth/access-level";
import { m } from "../../paraglide/messages";

/** Read again only on a refresh or a save: each read is a BOM from Onshape. */
export function useMassReportQuery(assembly: ElementPath) {
    const isSignedIn = useIsSignedIn();
    return useQuery<MassReportOut>({
        queryKey: massReportQueryKey(assembly),
        queryFn: isSignedIn
            ? () =>
                  apiGet("/mass-analysis", {
                      query: {
                          documentId: assembly.documentId,
                          instanceType: assembly.instanceType,
                          instanceId: assembly.instanceId,
                          elementId: assembly.elementId
                      }
                  })
            : skipToken,
        staleTime: Infinity
    });
}

export function useSetPartPropertiesMutation(assembly: ElementPath) {
    return useMutation({
        mutationFn: (body: PartPropertiesIn) =>
            apiPost<object>("/mass-analysis/part", { body }),
        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: massReportQueryKey(assembly)
            }),
        onError: getAppErrorHandler(m.massAnalysisSaveFailed())
    });
}
