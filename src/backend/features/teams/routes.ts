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
import { getApp } from "../../lib/context";
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
    MAX_TEAM_COLORS,
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
    getTeamsById,
    isCurrentMember,
    toFirstTeam
} from "./store";

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
                    z
                        .string()
                        .transform((color) => color.toLowerCase())
                        .pipe(z.string().regex(HEX_COLOR))
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
                    colors: settings.colors && [...new Set(settings.colors)]
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
