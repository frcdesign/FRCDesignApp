import { HttpStatus } from "http-status-ts";
import { handledError } from "../../lib/api-error";
import { type OAuthApi } from "../../lib/onshape/client";
import { getTeam, getTeamMembers } from "../../lib/onshape/endpoints/teams";
import { type SubteamMember } from "./contract";

/** The members of an Onshape team, refused unless the organization owns it. */
export async function readSubteam(
    api: OAuthApi,
    subteamId: string,
    companyId: string
): Promise<SubteamMember[]> {
    const team = await getTeam(api, subteamId);
    if (team.owner.id !== companyId) {
        throw handledError(
            "That Onshape team isn't in this organization.",
            HttpStatus.BAD_REQUEST
        );
    }
    const members = await getTeamMembers(api, subteamId);
    return members.map((member) => ({
        userId: member.member.id,
        admin: member.admin
    }));
}
