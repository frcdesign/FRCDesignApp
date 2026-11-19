import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { produce } from "immer";
import { useMemo } from "react";
import {
    type FirstTeam,
    type MyTeam,
    type Program,
    type RegisterTeamIn,
    type TeamAdminOut,
    type TeamContextOut,
    type TeamReportOut,
    type TeamSettings,
    toVendorPreferences,
    type VendorPreferences
} from "@backend/features/teams/contract";
import type { FavoritesData } from "@backend/features/favorites/contract";
import type { RecentsData } from "@backend/features/recents/contract";
import type { InsertableOut } from "@backend/features/library/contract";
import type {
    ConfigurationKey,
    PartialSelection
} from "@backend/features/configurations/contract";
import type { LibraryId } from "@backend/features/library/library-id";
import { apiDelete, apiGet, apiPost } from "../../lib/api-client";
import { toLibraryPath } from "../../lib/api-paths";
import { useLibraryId } from "../../lib/library";
import { useOnshapeLaunch } from "../../lib/onshape-params";
import { recentsQueryKey, libraryQueryKey } from "../../lib/query-keys";
import { showReportableErrorToast } from "../../lib/errors";
import { showSuccessToast } from "../../lib/notifications";
import { useIsSignedIn } from "../auth/access-level";
import { m } from "../../paraglide/messages";

const TEAMS_KEY = "teams";

export function teamContextQueryKey(documentId: string | undefined) {
    return [TEAMS_KEY, "context", documentId ?? ""];
}

function teamAdminQueryKey(teamId: string) {
    return [TEAMS_KEY, teamId, "admin"];
}

function teamReportQueryKey(teamId: string) {
    return [TEAMS_KEY, teamId, "report"];
}

function teamFavoritesQueryKey(libraryId: LibraryId, teamId: string) {
    return [...libraryQueryKey(libraryId), "team-favorites", teamId];
}

/** Under the user's recents' key, so an insert's invalidation reaches both. */
function teamRecentsQueryKey(libraryId: LibraryId, teamId: string) {
    return [...recentsQueryKey(libraryId), "team", teamId];
}

function toTeamPath(teamId: string): string {
    return `/teams/${encodeURIComponent(teamId)}`;
}

function useLaunchDocumentId(): string | undefined {
    return useOnshapeLaunch((state) => state.documentId);
}

/** Pending, and never fetched, while signed out. */
export function useTeamContextQuery() {
    const documentId = useLaunchDocumentId();
    const isSignedIn = useIsSignedIn();
    return useQuery({
        queryKey: teamContextQueryKey(documentId),
        queryFn: () =>
            apiGet<TeamContextOut>("/teams/context", {
                query: documentId ? { documentId } : {}
            }),
        enabled: isSignedIn
    });
}

/** The team uses are credited to now, if any. */
export function useCurrentTeam(): MyTeam | undefined {
    const { data } = useTeamContextQuery();
    const teamId = data?.current?.teamId;
    return data?.teams.find((team) => team.id === teamId);
}

export function useCurrentTeamSettings(): TeamSettings | undefined {
    return useCurrentTeam()?.settings;
}

/** Whether the caller may add, order and remove the current team's favorites. */
export function useCanEditTeamFavorites(): boolean {
    const team = useCurrentTeam();
    return (
        team !== undefined &&
        (team.role === "admin" || team.settings.membersEditFavorites)
    );
}

function useInvalidateTeams() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: [TEAMS_KEY] });
}

export function useChooseTeamMutation() {
    const invalidate = useInvalidateTeams();
    return useMutation({
        mutationFn: (teamId: string | undefined) =>
            apiPost("/teams/chosen", { body: { teamId } }),
        onError: (error) =>
            showReportableErrorToast(m.teamChooseFailed(), error),
        onSettled: invalidate
    });
}

export function useFirstTeamSearch(program: Program, query: string) {
    const isSignedIn = useIsSignedIn();
    return useQuery({
        queryKey: [TEAMS_KEY, "first", program, query],
        queryFn: () =>
            apiGet<FirstTeam[]>("/teams/first", {
                query: { program, q: query }
            }),
        enabled: isSignedIn && query.trim().length > 0,
        staleTime: 5 * 60 * 1000
    });
}

export function useRegisterTeamMutation() {
    const invalidate = useInvalidateTeams();
    return useMutation({
        mutationFn: (body: RegisterTeamIn) =>
            apiPost<{ teamId: string }>("/teams/register", { body }),
        onSettled: invalidate
    });
}

export function useTeamAdminQuery(teamId: string) {
    return useQuery({
        queryKey: teamAdminQueryKey(teamId),
        queryFn: () => apiGet<TeamAdminOut>(toTeamPath(teamId) + "/admin")
    });
}

export function useTeamSettingsMutation(teamId: string) {
    const invalidate = useInvalidateTeams();
    const queryClient = useQueryClient();
    const documentId = useLaunchDocumentId();
    return useMutation({
        mutationFn: (settings: Partial<TeamSettings>) =>
            apiPost(toTeamPath(teamId) + "/settings", { body: settings }),
        onMutate: (settings) => {
            queryClient.setQueryData(
                teamContextQueryKey(documentId),
                produce((data?: TeamContextOut) => {
                    const team = data?.teams.find((each) => each.id === teamId);
                    if (team) Object.assign(team.settings, settings);
                })
            );
        },
        onError: (error) =>
            showReportableErrorToast(m.teamSettingsFailed(), error),
        onSettled: invalidate
    });
}

/** Member and organization edits, each refetching the admin view. */
export function useTeamAdminMutation<T>(run: (input: T) => Promise<unknown>) {
    const invalidate = useInvalidateTeams();
    return useMutation({
        mutationFn: run,
        onError: (error) => showReportableErrorToast(m.teamEditFailed(), error),
        onSettled: invalidate
    });
}

export const teamApi = {
    setRole: (teamId: string, userId: string, role: string) =>
        apiPost(`${toTeamPath(teamId)}/members/${userId}`, {
            body: { role }
        }),
    removeMember: (teamId: string, userId: string) =>
        apiDelete(`${toTeamPath(teamId)}/members/${userId}`),
    removeOrganization: (teamId: string, organizationId: string) =>
        apiDelete(`${toTeamPath(teamId)}/organizations/${organizationId}`),
    refreshOrganization: (teamId: string, organizationId: string) =>
        apiPost(`${toTeamPath(teamId)}/organizations/${organizationId}/refresh`)
};

export function useTeamReportQuery(teamId: string) {
    return useQuery({
        queryKey: teamReportQueryKey(teamId),
        queryFn: () => apiGet<TeamReportOut>(toTeamPath(teamId) + "/report")
    });
}

export function useTeamFavoritesQuery() {
    const libraryId = useLibraryId();
    const teamId = useCurrentTeam()?.id;
    return useQuery({
        queryKey: teamFavoritesQueryKey(libraryId, teamId ?? ""),
        queryFn: () =>
            apiGet<FavoritesData>(
                `${toTeamPath(teamId!)}/favorites${toLibraryPath(libraryId)}`
            ),
        enabled: teamId !== undefined
    });
}

interface AddTeamFavorite {
    insertable: InsertableOut;
    selection?: PartialSelection;
    configurationKey?: ConfigurationKey;
}

/** Add, remove and reorder, each shown before the server confirms. */
export function useTeamFavoritesMutations() {
    const libraryId = useLibraryId();
    const teamId = useCurrentTeam()?.id ?? "";
    const queryClient = useQueryClient();
    const queryKey = teamFavoritesQueryKey(libraryId, teamId);
    const update = (recipe: (data: FavoritesData) => void) => {
        queryClient.setQueryData(
            queryKey,
            produce((data?: FavoritesData) => {
                if (data) recipe(data);
            })
        );
    };
    const settle = () => queryClient.invalidateQueries({ queryKey });
    const onError = (error: Error) =>
        showReportableErrorToast(m.teamFavoritesFailed(), error);

    const add = useMutation({
        mutationFn: ({ insertable, selection }: AddTeamFavorite) =>
            apiPost(
                `${toTeamPath(teamId)}/favorites${toLibraryPath(libraryId)}`,
                {
                    query: {
                        insertableId: insertable.id,
                        id: crypto.randomUUID()
                    },
                    body: { selection }
                }
            ),
        onError,
        onSettled: settle
    });
    const remove = useMutation({
        mutationFn: (favoriteId: string) =>
            apiDelete(`${toTeamPath(teamId)}/favorites/${favoriteId}`),
        onMutate: (favoriteId) =>
            update((data) => {
                delete data.favorites[favoriteId];
                data.favoriteOrder = data.favoriteOrder.filter(
                    (id) => id !== favoriteId
                );
            }),
        onError,
        onSettled: settle
    });
    const reorder = useMutation({
        mutationFn: (favoriteOrder: string[]) =>
            apiPost(
                `${toTeamPath(teamId)}/favorite-order${toLibraryPath(libraryId)}`,
                { body: { favoriteOrder } }
            ),
        onMutate: (favoriteOrder) =>
            update((data) => {
                data.favoriteOrder = favoriteOrder;
            }),
        onError,
        onSettled: settle
    });
    return { add, remove, reorder };
}

export function useTeamRecentsQuery(enabled: boolean) {
    const libraryId = useLibraryId();
    const teamId = useCurrentTeam()?.id;
    return useQuery({
        queryKey: teamRecentsQueryKey(libraryId, teamId ?? ""),
        queryFn: () =>
            apiGet<RecentsData>(
                `${toTeamPath(teamId!)}/recents${toLibraryPath(libraryId)}`
            ),
        enabled: enabled && teamId !== undefined
    });
}

export function useRefreshFirstTeamsMutation() {
    return useMutation({
        mutationFn: () => apiPost("/teams/refresh-first"),
        onSuccess: () => showSuccessToast(m.teamRefreshedFirst()),
        onError: (error) =>
            showReportableErrorToast(m.teamRefreshFirstFailed(), error)
    });
}

/** The parts the current team favorited, which the user's own list leaves out. */
export function useTeamFavoriteInsertableIds(): Set<string> {
    const data = useTeamFavoritesQuery().data;
    return new Set(
        Object.values(data?.favorites ?? {}).map(
            (favorite) => favorite.insertableId
        )
    );
}

/** The current team's vendor preferences, and whether they are known yet. */
export function useVendorPreferences(): {
    preferences: VendorPreferences;
    isSettled: boolean;
} {
    const query = useTeamContextQuery();
    const settings = useCurrentTeamSettings();
    // A query disabled while signed out never loads, and has nothing to wait for.
    const preferences = useMemo(
        () => toVendorPreferences(settings),
        [settings]
    );
    return { preferences, isSettled: !query.isLoading };
}
