/** What the owner sees of a library's admin team. */
export interface AdminTeamOut {
    /** Absent until the owner sets one. */
    teamId?: string;
    memberCount: number;
}

export interface AdminTeamMember {
    userId: string;
    /** An admin of the Onshape team, which makes them an admin of the library. */
    isTeamAdmin: boolean;
}
