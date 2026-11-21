/** The search param an invite link carries its token in. */
export const JOIN_TEAM_PARAM = "joinTeam";

/** Opens the app, which joins the caller to the team. */
export function inviteUrl(token: string): string {
    const url = new URL("/", window.location.origin);
    url.searchParams.set(JOIN_TEAM_PARAM, token);
    return url.href;
}
