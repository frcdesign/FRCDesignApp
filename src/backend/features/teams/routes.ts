import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { getDb } from "../../db/client";
import {
    firstTeams,
    teamMembers,
    teamOrganizations,
    teams
} from "../../db/schema";
import { handledError } from "../../lib/api-error";
import { cacheMiddleware } from "../../lib/cache";
import { type AppContext, getApp } from "../../lib/context";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { validate } from "../../lib/validate";
import {
    requireOwnerMiddleware,
    requireSignInMiddleware
} from "../auth/guards";
import { toDayKey } from "../analytics/day";
import { Vendor } from "../library/vendors";
import { resolveTeamContext } from "./context";
import {
    GenericVendorPolicy,
    INVITE_DAYS,
    MAX_COLOR_NAME_LENGTH,
    MAX_TEAM_COLORS,
    type TeamInviteOut,
    PERSONAL,
    Program,
    TeamRole,
    type FirstTeam,
    type TeamAdminOut,
    type TeamContextOut
} from "./contract";
import { refreshFirstTeams } from "./first-teams";
import {
    getRequiredParam,
    getTeamParam,
    requireTeamAdminMiddleware,
    requireTeamMemberMiddleware,
    teamRoute
} from "./guards";
import { getTeamRecents } from "./recents";
import { registerOrganization } from "./register";
import { readSubteam } from "./subteam";
import { getTeamReport } from "./report";
import {
    chosenTeamStore,
    documentOwnerStore,
    getMyTeams,
    getOrganizationRegistrations,
    companyAdminStore,
    getTeamsById,
    isCurrentMember,
    joinByInvite,
    renewInvitedMemberships,
    teamInviteStore,
    toFirstTeam
} from "./store";
import { getCompany } from "../../lib/onshape/endpoints/companies";
import { describeError } from "../../lib/error-text";

export const teamRoutes = getApp();

/** GET /api/teams/context?documentId= */
teamRoutes.get(
    "/teams/context",
    requireSignInMiddleware,
    cacheMiddleware(),
    async (c) => {
        const userId = await c.var.getUserId();
        const documentId = c.req.query("documentId") || undefined;
        const db = getDb(c.env.DB);
        const [myTeams, current, chosen, owner] = await Promise.all([
            getMyTeams(db, userId),
            resolveTeamContext(c.env, userId, documentId),
            chosenTeamStore.get(c.env.KV, userId),
            documentId
                ? documentOwnerStore.get(c.env.KV, documentId)
                : undefined
        ]);

        // An invited member keeps their team by opening the app.
        await renewInvitedMemberships(db, userId, new Date());

        let organization: TeamContextOut["organization"];
        if (owner?.kind !== undefined) {
            const registrations = await getOrganizationRegistrations(
                db,
                owner.companyId
            );
            const byId = await getTeamsById(
                db,
                registrations.map((registration) => registration.teamId)
            );
            organization = {
                companyId: owner.companyId,
                kind: owner.kind,
                name: registrations[0]?.name,
                isAdmin: await isCompanyAdmin(c, owner.companyId, userId),
                teams: [...byId.values()].map(({ team, first }) => ({
                    id: team.id,
                    first
                }))
            };
        }
        return c.json({
            teams: myTeams,
            current,
            chosen,
            organization
        } satisfies TeamContextOut);
    }
);

const SEARCH_LIMIT = 20;

/** Whether the caller administers the company, cached a day; undefined when Onshape won't say. */
async function isCompanyAdmin(
    c: AppContext,
    companyId: string,
    userId: string
): Promise<boolean | undefined> {
    const key = `${companyId}:${userId}`;
    const cached = await companyAdminStore.get(c.env.KV, key);
    if (cached !== undefined) return cached;
    try {
        const admin =
            (await getCompany(await c.var.getOnshapeApi(), companyId)).admin ===
            true;
        await companyAdminStore.put(c.env.KV, key, admin);
        return admin;
    } catch (error) {
        console.warn(
            `Failed to read a company's admins: ${describeError(error)}`
        );
        return undefined;
    }
}

/** GET /api/teams/first?program=&q=: by number's leading digits, or name. */
teamRoutes.get(
    "/teams/first",
    requireSignInMiddleware,
    validate(
        "query",
        z.object({ program: z.enum(Program), q: z.string().trim().max(60) })
    ),
    async (c) => {
        const { program, q } = c.req.valid("query");
        if (!q) return c.json([] satisfies FirstTeam[]);
        const pattern = `${q.replace(/[%_\\]/g, (char) => `\\${char}`)}%`;
        const rows = await getDb(c.env.DB)
            .select()
            .from(firstTeams)
            .where(
                and(
                    eq(firstTeams.program, program),
                    or(
                        like(sql`cast(${firstTeams.number} as text)`, pattern),
                        like(firstTeams.name, `%${pattern}`)
                    )
                )
            )
            .orderBy(asc(firstTeams.number))
            .limit(SEARCH_LIMIT)
            .all();
        return c.json(
            rows.map((row) => toFirstTeam(row, row)) satisfies FirstTeam[]
        );
    }
);

/** POST /api/teams/register: `RegisterTeamIn`. */
teamRoutes.post(
    "/teams/register",
    requireSignInMiddleware,
    validate(
        "json",
        z.object({
            documentId: z.string().min(1),
            subteamId: z.string().min(1).optional(),
            first: z
                .object({
                    program: z.enum(Program),
                    number: z.number().int().positive()
                })
                .optional(),
            teamId: z.string().min(1).optional()
        })
    ),
    async (c) => {
        const teamId = await registerOrganization(c, c.req.valid("json"));
        return c.json({ teamId });
    }
);

/** POST /api/teams/chosen: a team of the caller's, `personal`, or none for the default. */
teamRoutes.post(
    "/teams/chosen",
    requireSignInMiddleware,
    validate("json", z.object({ teamId: z.string().min(1).optional() })),
    async (c) => {
        const { teamId } = c.req.valid("json");
        const userId = await c.var.getUserId();
        if (teamId === undefined) {
            await chosenTeamStore.delete(c.env.KV, userId);
            return c.json({ success: true });
        }
        if (teamId !== PERSONAL) {
            const mine = await getMyTeams(getDb(c.env.DB), userId);
            if (!mine.some((team) => team.id === teamId)) {
                throw handledError(
                    "You aren't on that team.",
                    HttpStatus.FORBIDDEN
                );
            }
        }
        await chosenTeamStore.put(c.env.KV, userId, teamId);
        return c.json({ success: true });
    }
);

/** GET /api/teams/:teamId/admin */
teamRoutes.get(
    teamRoute() + "/admin",
    requireTeamAdminMiddleware,
    cacheMiddleware(),
    async (c) => {
        const teamId = getTeamParam(c);
        const db = getDb(c.env.DB);
        const [organizations, members] = await Promise.all([
            db
                .select()
                .from(teamOrganizations)
                .where(eq(teamOrganizations.teamId, teamId))
                .all(),
            db
                .select({ role: teamMembers.role })
                .from(teamMembers)
                .where(and(eq(teamMembers.teamId, teamId), isCurrentMember()))
                .all()
        ]);
        return c.json({
            organizations: organizations.map((organization) => ({
                id: organization.id,
                companyId: organization.companyId,
                kind: organization.kind,
                name: organization.name,
                subteamId: organization.subteamId || undefined,
                subteamMemberCount: organization.subteamId
                    ? organization.subteamMembers.length
                    : undefined
            })),
            memberCount: members.length,
            adminCount: members.filter(
                (member) => member.role === TeamRole.ADMIN
            ).length
        } satisfies TeamAdminOut);
    }
);

const HEX_COLOR = /^#[0-9a-f]{6}$/;

/** POST /api/teams/:teamId/settings: `Partial<TeamSettings>`. */
teamRoutes.post(
    teamRoute() + "/settings",
    requireTeamAdminMiddleware,
    validate(
        "json",
        z.object({
            membersEditFavorites: z.boolean().optional(),
            vendorRanking: z.array(z.enum(Vendor)).optional(),
            genericVendor: z.enum(GenericVendorPolicy).optional(),
            colors: z
                .array(
                    z.object({
                        name: z
                            .string()
                            .trim()
                            .min(1)
                            .max(MAX_COLOR_NAME_LENGTH),
                        hex: z
                            .string()
                            .transform((color) => color.toLowerCase())
                            .pipe(z.string().regex(HEX_COLOR))
                    })
                )
                .max(MAX_TEAM_COLORS)
                .optional()
        })
    ),
    async (c) => {
        const settings = c.req.valid("json");
        if (Object.keys(settings).length > 0) {
            await getDb(c.env.DB)
                .update(teams)
                .set({
                    ...settings,
                    vendorRanking: settings.vendorRanking && [
                        ...new Set(settings.vendorRanking)
                    ],
                    // One name per color: the first a list gives it wins.
                    colors:
                        settings.colors &&
                        settings.colors.filter(
                            (color, index, all) =>
                                all.findIndex(
                                    (each) => each.hex === color.hex
                                ) === index
                        )
                })
                .where(eq(teams.id, getTeamParam(c)));
        }
        return c.json({ success: true });
    }
);

/** DELETE /api/teams/:teamId/organizations/:organizationId */
teamRoutes.delete(
    teamRoute() + "/organizations/:organizationId",
    requireTeamAdminMiddleware,
    async (c) => {
        await getDb(c.env.DB)
            .delete(teamOrganizations)
            .where(
                and(
                    eq(
                        teamOrganizations.id,
                        getRequiredParam(c, "organizationId")
                    ),
                    eq(teamOrganizations.teamId, getTeamParam(c))
                )
            );
        return c.json({ success: true });
    }
);

/** POST /api/teams/:teamId/organizations/:organizationId/refresh: syncs a subteam's members. */
teamRoutes.post(
    teamRoute() + "/organizations/:organizationId/refresh",
    requireTeamAdminMiddleware,
    async (c) => {
        const db = getDb(c.env.DB);
        const organization = await db
            .select()
            .from(teamOrganizations)
            .where(
                and(
                    eq(
                        teamOrganizations.id,
                        getRequiredParam(c, "organizationId")
                    ),
                    eq(teamOrganizations.teamId, getTeamParam(c))
                )
            )
            .get();
        if (!organization?.subteamId) {
            throw handledError(
                "That organization has no Onshape team.",
                HttpStatus.BAD_REQUEST
            );
        }
        const subteamMembers = await readSubteam(
            await c.var.getOnshapeApi(),
            organization.subteamId,
            organization.companyId
        );
        await db
            .update(teamOrganizations)
            .set({ subteamMembers, syncedAt: new Date() })
            .where(eq(teamOrganizations.id, organization.id));
        return c.json({ memberCount: subteamMembers.length });
    }
);

/** POST /api/teams/:teamId/invites: a link anybody signed in can join by, for `INVITE_DAYS`. */
teamRoutes.post(
    teamRoute() + "/invites",
    requireTeamAdminMiddleware,
    async (c) => {
        const token = crypto.randomUUID();
        await teamInviteStore.put(c.env.KV, token, { teamId: getTeamParam(c) });
        return c.json({
            token,
            expiresAt: Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000
        } satisfies TeamInviteOut);
    }
);

/** POST /api/teams/join: `{ token }` from an invite link. */
teamRoutes.post(
    "/teams/join",
    requireSignInMiddleware,
    validate("json", z.object({ token: z.string().min(1) })),
    async (c) => {
        const invite = await teamInviteStore.get(
            c.env.KV,
            c.req.valid("json").token
        );
        if (!invite) {
            throw handledError(
                "This invite has expired.",
                HttpStatus.NOT_FOUND
            );
        }
        await joinByInvite(
            getDb(c.env.DB),
            invite.teamId,
            await c.var.getUserId(),
            new Date()
        );
        return c.json({ teamId: invite.teamId });
    }
);

/** GET /api/teams/:teamId/recents/library/:libraryId */
teamRoutes.get(
    teamRoute() + "/recents" + libraryRoute(),
    requireTeamMemberMiddleware,
    cacheMiddleware(),
    async (c) =>
        c.json(
            await getTeamRecents(
                getDb(c.env.DB),
                getTeamParam(c),
                getLibraryParam(c)
            )
        )
);

/** GET /api/teams/:teamId/report */
teamRoutes.get(
    teamRoute() + "/report",
    requireTeamMemberMiddleware,
    cacheMiddleware(),
    async (c) => {
        const report = await getTeamReport(
            getDb(c.env.DB),
            getTeamParam(c),
            toDayKey(Date.now())
        );
        if (!report) {
            throw handledError("Team not found.", HttpStatus.NOT_FOUND);
        }
        return c.json(report);
    }
);

/** POST /api/teams/refresh-first: the weekly refresh, on demand. */
teamRoutes.post("/teams/refresh-first", requireOwnerMiddleware, async (c) => {
    await refreshFirstTeams(c.env);
    return c.json({ success: true });
});
