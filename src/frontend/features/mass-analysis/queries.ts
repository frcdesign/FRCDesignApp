import { skipToken, useQuery } from "@tanstack/react-query";
import { type MassReportOut } from "@backend/features/mass-analysis/contract";
import { type ElementPath } from "@backend/lib/onshape/path";
import { apiGet } from "../../lib/api-client";
import { massReportQueryKey } from "../../lib/query-keys";
import { useIsSignedIn } from "../auth/access-level";

/** Read again only on a refresh: each read is a BOM from Onshape. */
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
