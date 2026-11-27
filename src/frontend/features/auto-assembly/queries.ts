import {
    hashKey,
    keepPreviousData,
    skipToken,
    useIsFetching,
    useMutation,
    useQuery
} from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { useMemo } from "react";
import {
    type AssemblyJobStatus,
    type AutoAssemblyIn,
    type DeclaredPartsIn,
    type ExistingScrew,
    type PickCheckIn,
    type PickCheckOut,
    type PickProblem,
    ProblemSeverity
} from "@backend/features/auto-assembly/contract";
import {
    FASTENER_LIBRARY,
    type FastenerSet
} from "@backend/features/auto-assembly/studios";
import { type ElementPath } from "@backend/lib/onshape/path";
import { apiGet, apiPost } from "../../lib/api-client";
import { getAppErrorHandler } from "../../lib/errors";
import { queryClient } from "../../lib/query-client";
import {
    assemblyJobQueryKey,
    fastenerSetQueryKey,
    pickCheckQueryKey,
    pickChecksQueryKey,
    prepareHolesQueryKey
} from "../../lib/query-keys";
import { useIsSignedIn } from "../auth/access-level";
import { getLibraryVersionQuery } from "../library/queries";
import { type RowProblem } from "../../components/query-list";
import { Status } from "../../lib/status";
import {
    HoldScope,
    unlessHeld,
    useRateLimitHold
} from "../../lib/rate-limit-holds";
import { m } from "../../paraglide/messages";

const FASTENER_VERSION_STALE_MS = 60 * 1000;

/** The fasteners FRCDesignLib loaded, at its cache version, which each load bumps; null before it loads them. */
export function useFastenerSetQuery() {
    const versionQuery = useQuery({
        ...getLibraryVersionQuery(FASTENER_LIBRARY),
        // Pushes reach only the shown library's viewers, so others ask again as they open.
        staleTime: FASTENER_VERSION_STALE_MS
    });
    const cacheVersion = versionQuery.data;
    return useQuery<FastenerSet | null>({
        queryKey: fastenerSetQueryKey(cacheVersion),
        queryFn:
            cacheVersion === undefined
                ? skipToken
                : () =>
                      apiGet("/auto-assembly/parts", { cacheId: cacheVersion }),
        // Keeps the last version's fasteners up while the next one's load.
        placeholderData: keepPreviousData,
        staleTime: Infinity,
        gcTime: Infinity
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
    const hold = useRateLimitHold(HoldScope.AUTO_ASSEMBLY);
    useQuery({
        queryKey: prepareHolesQueryKey(assembly),
        queryFn:
            isSignedIn && !hold
                ? () =>
                      unlessHeld(HoldScope.AUTO_ASSEMBLY, () =>
                          apiPost<{ holes: number }>("/auto-assembly/prepare", {
                              body: { assembly }
                          })
                      )
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
            unlessHeld(HoldScope.AUTO_ASSEMBLY, () =>
                apiPost<AssemblyJobStatus>("/auto-assembly/insert", { body })
            ),
        onSuccess: (status) =>
            queryClient.setQueryData(assemblyJobQueryKey(assembly), status),
        onError: getAppErrorHandler(m.autoAssemblyStartFailed())
    });
}

/** Starts a run placing every part the assembly's FeatureScripts declared. */
export function useAssembleDeclaredMutation(assembly: ElementPath) {
    return useMutation({
        mutationKey: ["auto-assembly-declared", assembly],
        mutationFn: () =>
            unlessHeld(HoldScope.AUTO_ASSEMBLY, () =>
                apiPost<AssemblyJobStatus>("/auto-assembly/declared", {
                    body: { assembly } satisfies DeclaredPartsIn
                })
            ),
        onSuccess: (status) =>
            queryClient.setQueryData(assemblyJobQueryKey(assembly), status),
        onError: getAppErrorHandler(m.autoAssemblyStartFailed())
    });
}

/** Long enough that picking edges one at a time checks once per pause, not once per pick. */
export const PICK_CHECK_DELAY_MS = 1500;

export interface PickProblems {
    /** Each pick's problem, by its row key. */
    problems: Map<string, RowProblem>;
    /** The size the first hole picked is made for. */
    holeSize?: string;
    /** Whether that hole is countersunk. */
    isHoleCountersunk?: boolean;
    /** The first screw to update, and the washers and nut on it. */
    existingScrew?: ExistingScrew;
    /** Whether a check is waiting for the picks to settle, or going. */
    isChecking: boolean;
    /** Why no check is sent: Onshape is limiting Auto Assembly, for how long. */
    hold?: string;
}

/**
 * Each pick's problem, checked in the background once the picks settle; a
 * check reads Onshape only for what changed since the last. None is sent while
 * Onshape is limiting Auto Assembly. Memoize `body`.
 */
export function usePickProblems(body: PickCheckIn | undefined): PickProblems {
    const isSignedIn = useIsSignedIn();
    const hold = useRateLimitHold(HoldScope.AUTO_ASSEMBLY);
    const [settled] = useDebouncedValue(body, PICK_CHECK_DELAY_MS);
    // One check at a time: a slow one would otherwise have the next run beside it
    const othersChecking = useIsFetching({
        queryKey: pickChecksQueryKey(),
        predicate: (query) =>
            query.queryHash !== hashKey(pickCheckQueryKey(settled))
    });
    const { data, isFetching, isPlaceholderData } = useQuery<PickCheckOut>({
        queryKey: pickCheckQueryKey(settled),
        queryFn:
            settled && isSignedIn && !hold && othersChecking === 0
                ? () =>
                      unlessHeld(HoldScope.AUTO_ASSEMBLY, () =>
                          apiPost("/auto-assembly/check", { body: settled })
                      )
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
            isSignedIn &&
            !hold &&
            body !== undefined &&
            (settled !== body || isFetching || othersChecking > 0),
        ...(hold ? { hold } : {})
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
