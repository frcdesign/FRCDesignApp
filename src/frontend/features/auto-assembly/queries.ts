import {
    keepPreviousData,
    skipToken,
    useMutation,
    useQuery
} from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { useMemo } from "react";
import {
    type AssemblyJobStatus,
    type AutoAssemblyIn,
    type PickCheckIn,
    type PickCheckOut,
    type PickProblem,
    ProblemSeverity
} from "@backend/features/auto-assembly/contract";
import { type FastenerSet } from "@backend/features/auto-assembly/studios";
import { type ElementPath } from "@backend/lib/onshape/path";
import { apiGet, apiPost } from "../../lib/api-client";
import { getAppErrorHandler } from "../../lib/errors";
import { queryClient } from "../../lib/query-client";
import {
    FASTENER_SET_QUERY_KEY,
    assemblyJobQueryKey,
    pickCheckQueryKey,
    prepareHolesQueryKey
} from "../../lib/query-keys";
import { useIsSignedIn } from "../auth/access-level";
import { type RowProblem } from "../../components/query-list";
import { Status } from "../../lib/status";
import { m } from "../../paraglide/messages";

/** The fasteners the library loaded, which change only when it reloads them; null before it loads them. */
export function useFastenerSetQuery() {
    return useQuery<FastenerSet | null>({
        queryKey: FASTENER_SET_QUERY_KEY,
        queryFn: () => apiGet("/auto-assembly/parts"),
        // None yet is asked again each time the panel opens, as a load may have finished since
        staleTime: (query) => (query.state.data ? 10 * 60 * 1000 : 0)
    });
}

/** The run this assembly last started; a push says when it moves on. */
export function useAssemblyJobQuery(assembly: ElementPath | undefined) {
    const isSignedIn = useIsSignedIn();
    return useQuery<AssemblyJobStatus>({
        queryKey: assemblyJobQueryKey(assembly),
        queryFn:
            assembly && isSignedIn
                ? () =>
                      apiGet("/auto-assembly/job", {
                          query: {
                              documentId: assembly.documentId,
                              instanceId: assembly.instanceId,
                              elementId: assembly.elementId
                          }
                      })
                : skipToken,
        staleTime: Infinity
    });
}

/** Long enough that switching tabs and back doesn't scan again. */
const PREPARE_STALE_MS = 60 * 1000;

/**
 * Has the server scan the assembly's Part Studios as the panel opens, so the
 * first check reads them from the cache; nothing waits on it.
 */
export function usePrepareHoles(assembly: ElementPath): void {
    const isSignedIn = useIsSignedIn();
    useQuery({
        queryKey: prepareHolesQueryKey(assembly),
        queryFn: isSignedIn
            ? () =>
                  apiPost<{ holes: number }>("/auto-assembly/prepare", {
                      body: { assembly }
                  })
            : skipToken,
        staleTime: PREPARE_STALE_MS,
        retry: false
    });
}

/** Starts a run; it carries on whether or not anybody stays on the page. */
export function useInsertMutation(assembly: ElementPath) {
    return useMutation({
        mutationKey: ["auto-assembly-insert", assembly],
        mutationFn: (body: AutoAssemblyIn) =>
            apiPost<AssemblyJobStatus>("/auto-assembly/insert", { body }),
        onSuccess: (status) =>
            queryClient.setQueryData(assemblyJobQueryKey(assembly), status),
        onError: getAppErrorHandler(m.autoAssemblyStartFailed())
    });
}

/** Long enough that picking several in a row checks them once. */
const PICK_CHECK_DELAY_MS = 600;

export interface PickProblems {
    /** Each pick's problem, by its row key. */
    problems: Map<string, RowProblem>;
    /** The size the first hole picked is made for. */
    holeSize?: string;
    /** Whether that hole is countersunk. */
    isHoleCountersunk?: boolean;
    /** The first screw to update's inputs. */
    existingScrew?: Record<string, string>;
    /** Whether a check is waiting for the picks to settle, or going. */
    isChecking: boolean;
}

/**
 * Each pick's problem, checked in the background once the picks settle; each
 * check reads the assembly in Onshape. Memoize `body`.
 */
export function usePickProblems(body: PickCheckIn | undefined): PickProblems {
    const isSignedIn = useIsSignedIn();
    const [settled] = useDebouncedValue(body, PICK_CHECK_DELAY_MS);
    const { data, isFetching, isPlaceholderData } = useQuery<PickCheckOut>({
        queryKey: pickCheckQueryKey(settled),
        queryFn:
            settled && isSignedIn
                ? () => apiPost("/auto-assembly/check", { body: settled })
                : skipToken,
        // The last check's marks stay while the next is going
        placeholderData: keepPreviousData,
        staleTime: Infinity,
        retry: false
    });
    const problems = useMemo(
        () =>
            new Map(
                (data?.problems ?? []).map((problem) => [
                    problem.key,
                    toRowProblem(problem)
                ])
            ),
        [data]
    );
    return {
        problems,
        // The last picks' hole is no guide to these
        holeSize: isPlaceholderData ? undefined : data?.holeSize,
        isHoleCountersunk: isPlaceholderData
            ? undefined
            : data?.isHoleCountersunk,
        existingScrew: isPlaceholderData ? undefined : data?.existingScrew,
        isChecking:
            isSignedIn && body !== undefined && (settled !== body || isFetching)
    };
}

/** A problem as a list row shows it. */
export function toRowProblem(problem: Omit<PickProblem, "key">): RowProblem {
    return {
        message: problem.message,
        status:
            problem.severity === ProblemSeverity.WARNING
                ? Status.WARNING
                : Status.ERROR
    };
}
