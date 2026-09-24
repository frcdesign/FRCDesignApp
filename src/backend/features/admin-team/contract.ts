/** What the owner sees of a library's admin team. */
export interface AdminTeamOut {
    /** Absent until the owner sets one. */
    teamId?: string;
    memberCount: number;
}
