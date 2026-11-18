/** Route middleware for routes under `teamRoute()`: membership is a D1 read, never an Onshape call. */
import type { MiddlewareHandler } from "hono";
import { forbiddenError } from "../../lib/api-error";
import type { AppContext, AppContextEnv } from "../../lib/context";
import { getDb } from "../../db/client";
import { teams } from "../../db/schema";
import { eq } from "drizzle-orm";
import { requireSignIn } from "../auth/guards";
import { TeamRole } from "./contract";
import { getRole } from "./store";

export function teamRoute(): string {
    return "/teams/:teamId";
}

export function getTeamParam(c: AppContext): string {
    return getRequiredParam(c, "teamId");
}

/** For a param the route's own path names. */
export function getRequiredParam(c: AppContext, name: string): string {
    const value = c.req.param(name);
    if (!value) throw new Error(`Missing ${name} route param`);
    return value;
}

export async function getCallerRole(
    c: AppContext
): Promise<TeamRole | undefined> {
    return getRole(getDb(c.env.DB), getTeamParam(c), await c.var.getUserId());
}

function requireRole(roles: TeamRole[]): MiddlewareHandler<AppContextEnv> {
    return async (c, next) => {
        await requireSignIn(c);
        const role = await getCallerRole(c);
        if (role === undefined || !roles.includes(role)) {
            throw forbiddenError(
                roles.includes(TeamRole.MEMBER)
                    ? "You must be on this team to use this functionality."
                    : "You must be an admin of this team to use this functionality."
            );
        }
        await next();
    };
}

export const requireTeamMemberMiddleware = requireRole([
    TeamRole.MEMBER,
    TeamRole.ADMIN
]);

export const requireTeamAdminMiddleware = requireRole([TeamRole.ADMIN]);

/** An admin, or a member while the team lets members edit its favorites. */
export const requireTeamFavoritesEditorMiddleware: MiddlewareHandler<
    AppContextEnv
> = async (c, next) => {
    await requireSignIn(c);
    const role = await getCallerRole(c);
    if (role === TeamRole.ADMIN) {
        await next();
        return;
    }
    const team = await getDb(c.env.DB)
        .select({ membersEditFavorites: teams.membersEditFavorites })
        .from(teams)
        .where(eq(teams.id, getTeamParam(c)))
        .get();
    if (role === TeamRole.MEMBER && team?.membersEditFavorites) {
        await next();
        return;
    }
    throw forbiddenError("Your team's admins manage its favorites.");
};
