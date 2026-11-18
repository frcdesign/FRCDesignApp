/** Registering an organization to a team: the only team flow that asks Onshape anything. */
import { and, eq } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "../../db/client";
import { firstTeams, teamOrganizations, teams } from "../../db/schema";
import { forbiddenError, handledError } from "../../lib/api-error";
import { type AppContext } from "../../lib/context";
import { type OAuthApi } from "../../lib/onshape/client";
import { getCompany } from "../../lib/onshape/endpoints/companies";
import { getDocument } from "../../lib/onshape/endpoints/documents";
import { getTeam, getTeamMembers } from "../../lib/onshape/endpoints/teams";
import { type RegisterTeamIn, TeamRole } from "./contract";
import { toDocumentOwner } from "./membership";
import { documentOwnerStore, getRole, upsertMember } from "./store";

/** Returns the team the organization joined. */
export async function registerOrganization(
    c: AppContext,
    request: RegisterTeamIn
): Promise<string> {
    const api = await c.var.getOnshapeApi();
    const userId = await c.var.getUserId();
    const db = getDb(c.env.DB);

    const document = await getDocument(api, {
        documentId: request.documentId
    });
    const owner = toDocumentOwner(document);
    if (owner?.kind === undefined) {
        throw handledError(
            "Only an organization's document can register a team.",
            HttpStatus.BAD_REQUEST
        );
    }
    await documentOwnerStore.put(c.env.KV, document.id, owner);

    const company = await getCompany(api, owner.companyId);
    if (company.admin !== true) {
        throw forbiddenError(
            `Only an admin of ${company.name} can register it to a team.`
        );
    }
    const subteamMembers = request.subteamId
        ? await readSubteam(api, request.subteamId, owner.companyId)
        : [];

    const subteamId = request.subteamId ?? "";
    const taken = await db
        .select({ id: teamOrganizations.id })
        .from(teamOrganizations)
        .where(
            and(
                eq(teamOrganizations.companyId, owner.companyId),
                eq(teamOrganizations.subteamId, subteamId)
            )
        )
        .get();
    if (taken) {
        throw handledError(
            request.subteamId
                ? "That Onshape team is already registered."
                : `${company.name} is already registered.`,
            HttpStatus.CONFLICT
        );
    }

    const now = new Date();
    const writes: BatchItem<"sqlite">[] = [];
    let teamId: string;
    if (request.teamId) {
        if ((await getRole(db, request.teamId, userId)) !== TeamRole.ADMIN) {
            throw forbiddenError(
                "Only the team's admins can add an organization."
            );
        }
        const joined = await db
            .select({ id: teamOrganizations.id })
            .from(teamOrganizations)
            .where(
                and(
                    eq(teamOrganizations.teamId, request.teamId),
                    eq(teamOrganizations.companyId, owner.companyId)
                )
            )
            .get();
        if (joined) {
            throw handledError(
                `${company.name} is already on this team.`,
                HttpStatus.CONFLICT
            );
        }
        teamId = request.teamId;
    } else if (request.first) {
        const listed = await db
            .select({ number: firstTeams.number })
            .from(firstTeams)
            .where(
                and(
                    eq(firstTeams.program, request.first.program),
                    eq(firstTeams.number, request.first.number)
                )
            )
            .get();
        if (!listed) {
            throw handledError(
                "FIRST doesn't list that team.",
                HttpStatus.BAD_REQUEST
            );
        }
        teamId = crypto.randomUUID();
        writes.push(
            db.insert(teams).values({
                id: teamId,
                program: request.first.program,
                number: request.first.number,
                registeredAt: now,
                registeredBy: userId
            })
        );
    } else {
        throw handledError("Choose a team.", HttpStatus.BAD_REQUEST);
    }

    writes.push(
        db.insert(teamOrganizations).values({
            teamId,
            companyId: owner.companyId,
            kind: owner.kind,
            name: company.name,
            subteamId,
            subteamMembers,
            registeredAt: now,
            registeredBy: userId
        }),
        upsertMember(db, teamId, userId, TeamRole.ADMIN, now)
    );
    await db.batch([writes[0], ...writes.slice(1)]);
    return teamId;
}

/** The members of an Onshape team, refused unless the organization owns it. */
export async function readSubteam(
    api: OAuthApi,
    subteamId: string,
    companyId: string
): Promise<string[]> {
    const team = await getTeam(api, subteamId);
    if (team.owner.id !== companyId) {
        throw handledError(
            "That Onshape team isn't in this organization.",
            HttpStatus.BAD_REQUEST
        );
    }
    const members = await getTeamMembers(api, subteamId);
    return members.map((member) => member.member.id);
}
