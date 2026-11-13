import { useMemo } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import {
    keepPreviousData,
    skipToken,
    useMutation,
    useQuery
} from "@tanstack/react-query";
import {
    type EditCheckIn,
    type EditCheckOut,
    type EditPartsIn,
    type EditPartsOut
} from "@backend/features/edit-parts/contract";
import { type RowProblem } from "../../components/query-list";
import { apiPost } from "../../lib/api-client";
import { handleAppError } from "../../lib/errors";
import { showLoadingToast, showSuccessToast } from "../../lib/notifications";
import { editCheckQueryKey } from "../../lib/query-keys";
import { m } from "../../paraglide/messages";
import { toRowProblem } from "../auto-assembly/queries";

/** Long enough that picking several parts asks once. */
const CHECK_DELAY_MS = 600;

interface EditCheck {
    /** Undefined until the first answer, and with nothing picked. */
    check: EditCheckOut | undefined;
    /** By a pick's `selectionKey`. */
    problems: Map<string, RowProblem>;
    isChecking: boolean;
}

/** What the picks are copies of and what's wrong with each, asked a moment after they change. */
export function useEditCheck(body: EditCheckIn | undefined): EditCheck {
    const [settled] = useDebouncedValue(body, CHECK_DELAY_MS);
    const { data, isFetching } = useQuery<EditCheckOut>({
        queryKey: editCheckQueryKey(settled),
        queryFn: settled
            ? () => apiPost("/edit-parts/check", { body: settled })
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
        check: body ? data : undefined,
        problems,
        isChecking: body !== undefined && (settled !== body || isFetching)
    };
}

/** Replaces each copy with its new configuration. `name` is the part's, for the toasts. */
export function useEditPartsMutation(name: string) {
    const toastId = "edit-parts";
    return useMutation({
        mutationKey: ["edit-parts"],
        mutationFn: (body: EditPartsIn) => {
            showLoadingToast(m.editPartsUpdating({ name }), toastId);
            return apiPost<EditPartsOut>("/edit-parts", { body });
        },
        onSuccess: (result) =>
            showSuccessToast(
                m.editPartsUpdated({ count: result.updated }),
                toastId
            ),
        onError: (error) =>
            handleAppError(error, m.editPartsFailed({ name }), toastId)
    });
}
