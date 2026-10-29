import { OnshapeApi } from "../client";

export interface OnshapeTeamMember {
    /** Whether the member administers the team, not only belongs to it. */
    admin: boolean;
    member: { id: string };
}

/** Onshape pages the list; this is as many as it hands back at once. */
const PAGE_SIZE = 20;

/** Every member of a team, across however many pages. */
export async function getTeamMembers(
    client: OnshapeApi,
    teamId: string
): Promise<OnshapeTeamMember[]> {
    const members: OnshapeTeamMember[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
        const page: { items: OnshapeTeamMember[] } = await client.get(
            `/teams/${encodeURIComponent(teamId)}/members`,
            { query: { offset: String(offset), limit: String(PAGE_SIZE) } }
        );
        members.push(...page.items);
        if (page.items.length < PAGE_SIZE) {
            return members;
        }
    }
}
