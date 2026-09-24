/** What the owner sees of a library's admin team. */
export interface AdminTeamOut {
    /** Null until the owner sets one. */
    teamId: string | null;
    memberCount: number;
}
