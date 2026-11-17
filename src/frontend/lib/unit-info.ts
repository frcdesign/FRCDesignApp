import { skipToken, useQuery } from "@tanstack/react-query";
import { type UnitInfo } from "@backend/features/configurations/contract";
import { apiGet } from "./api-client";
import { useTargetElement } from "./onshape-params";
import { unitInfoQueryKey } from "./query-keys";

/** Undefined outside a document, or until they load; quantities show their own unit meanwhile. */
export function useUnitInfo(): UnitInfo | undefined {
    const target = useTargetElement();
    const query = useQuery<UnitInfo>({
        queryKey: unitInfoQueryKey(target),
        queryFn: target
            ? () =>
                  apiGet("/unit-info", {
                      query: {
                          documentId: target.documentId,
                          instanceId: target.instanceId,
                          instanceType: target.instanceType
                      }
                  })
            : skipToken,
        // A document's units do not change while it is open.
        staleTime: Infinity
    });
    return query.data;
}
