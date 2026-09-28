import { useMutation, useQuery } from "@tanstack/react-query";
import type { AdminTeamOut } from "@backend/features/admin-team/contract";
import { apiGet, apiPost } from "../../lib/api-client";
import { toLibraryPath } from "../../lib/api-paths";
import { getAppErrorHandler } from "../../lib/errors";
import { useLibraryId } from "../../lib/library";
import { showSuccessToast } from "../../lib/notifications";
import { queryClient } from "../../lib/query-client";
import { adminTeamQueryKey } from "../../lib/query-keys";

export function useAdminTeamQuery() {
    const libraryId = useLibraryId();
    return useQuery({
        queryKey: adminTeamQueryKey(libraryId),
        queryFn: () =>
            apiGet<AdminTeamOut>("/admin-team" + toLibraryPath(libraryId))
    });
}

/** The version bump it causes refreshes everyone's access. */
export function useSetAdminTeamMutation() {
    const libraryId = useLibraryId();
    return useMutation({
        mutationKey: ["admin-team", libraryId],
        mutationFn: (teamId: string | null) =>
            apiPost<AdminTeamOut>("/admin-team" + toLibraryPath(libraryId), {
                body: { teamId }
            }),
        onError: getAppErrorHandler("Failed to set the admin team!"),
        onSuccess: (team) => {
            queryClient.setQueryData(adminTeamQueryKey(libraryId), team);
            showSuccessToast(
                team.teamId
                    ? `Admin team set: ${team.memberCount} members.`
                    : "Admin team removed."
            );
        }
    });
}

/** Pulls the team's members again, for a change made in Onshape. */
export function useRefreshAdminTeamMutation() {
    const libraryId = useLibraryId();
    return useMutation({
        mutationKey: ["refresh-admin-team", libraryId],
        mutationFn: () =>
            apiPost<AdminTeamOut>(
                "/admin-team/refresh" + toLibraryPath(libraryId)
            ),
        onError: getAppErrorHandler("Failed to refresh the admin team!"),
        onSuccess: (team) => {
            queryClient.setQueryData(adminTeamQueryKey(libraryId), team);
            showSuccessToast(
                team.teamId
                    ? `Admin team refreshed: ${team.memberCount} members.`
                    : "This library has no admin team."
            );
        }
    });
}
