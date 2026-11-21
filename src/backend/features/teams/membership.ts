/** Membership is proven by a launch: editing an organization's document joins its team. */
import { and, eq, inArray } from "drizzle-orm";
import { type Db, getDb } from "../../db/client";
import { teamMembers, teamOrganizations } from "../../db/schema";
import { type OAuthApi } from "../../lib/onshape/client";
import { getCompany } from "../../lib/onshape/endpoints/companies";
import { readSubteam } from "./subteam";
import { type AppContext } from "../../lib/context";
import { describeError } from "../../lib/error-text";
import { OnshapePermission } from "../../lib/onshape/endpoints/permissions";
import {
    OnshapeOwnerType,
    type OnshapeDocumentInfo
} from "../../lib/onshape/types";
import { PERSONAL_COMPANY_ID } from "../auth/personal-company";
import { ONSHAPE_RECHECK_HOURS, OrganizationKind, TeamRole } from "./contract";
import {
    documentOwnerStore,
    getOrganizationRegistrations,
    type DocumentOwner,
    upsertMember
} from "./store";

export function toDocumentOwner(
    document: OnshapeDocumentInfo
): DocumentOwner | undefined {
    switch (document.owner?.type) {
        case OnshapeOwnerType.USER:
            return { companyId: PERSONAL_COMPANY_ID };
        case OnshapeOwnerType.COMPANY:
            return {
                companyId: document.owner.id,
                kind: document.owner.isEnterpriseOwnedResource
                    ? OrganizationKind.ENTERPRISE
                    : OrganizationKind.CLASSROOM
            };
        default:
            return undefined;
    }
}

/**
 * At `/init`, from the document it already read. Never throws: a launch
 * opens the app whatever happens to its record.
 */
export async function recordLaunch(
    c: AppContext,
    document: OnshapeDocumentInfo
): Promise<void> {
    try {
        const owner = toDocumentOwner(document);
        if (!owner) return;
        await documentOwnerStore.put(c.env.KV, document.id, owner);
        if (
            owner.kind === undefined ||
            !document.permissionSet?.includes(OnshapePermission.WRITE)
        ) {
            return;
        }
        await joinOrganizationTeams(
            c,
            owner.companyId,
            await c.var.getUserId()
        );
    } catch (error) {
        console.error(`Failed to record a launch: ${describeError(error)}`);
    }
}

type Registration = Awaited<
    ReturnType<typeof getOrganizationRegistrations>
>[number];

function isStale(checkedAt: Date | null, now: Date): boolean {
    return (
        checkedAt === null ||
        now.getTime() - checkedAt.getTime() >
            ONSHAPE_RECHECK_HOURS * 60 * 60 * 1000
    );
}

/**
 * Every team the organization registered for all its editors, or for a
 * subteam the user is in, with the role Onshape gives them: an admin of the
 * company or of the subteam is the team's admin.
 */
async function joinOrganizationTeams(
    c: AppContext,
    companyId: string,
    userId: string
): Promise<void> {
    const db = getDb(c.env.DB);
    const registrations = await getOrganizationRegistrations(db, companyId);
    if (registrations.length === 0) return;
    const now = new Date();
    const api = await c.var.getOnshapeApi();

    const synced = await Promise.all(
        registrations.map((registration) =>
            resyncSubteam(db, api, registration, now)
        )
    );
    const joined = synced.flatMap((registration) => {
        if (registration.subteamId === "")
            return [{ registration, admin: false }];
        const member = registration.subteamMembers.find(
            (each) => each.userId === userId
        );
        return member ? [{ registration, admin: member.admin }] : [];
    });
    if (joined.length === 0) return;

    const companyAdmin = await checkCompanyAdmin(
        db,
        api,
        companyId,
        userId,
        joined.map(({ registration }) => registration.teamId),
        now
    );
    const writes = joined.map(({ registration, admin }) => {
        // Unasked, a subteam's own word still makes an admin; it can't unmake one.
        const role =
            companyAdmin === undefined
                ? admin
                    ? TeamRole.ADMIN
                    : undefined
                : companyAdmin || admin
                  ? TeamRole.ADMIN
                  : TeamRole.MEMBER;
        return upsertMember(db, registration.teamId, userId, role, now);
    });
    await db.batch([writes[0], ...writes.slice(1)]);
}

/** A subteam's members, read again once a day under the launching user's session; as stored when Onshape won't say. */
async function resyncSubteam(
    db: Db,
    api: OAuthApi,
    registration: Registration,
    now: Date
): Promise<Registration> {
    if (registration.subteamId === "" || !isStale(registration.syncedAt, now)) {
        return registration;
    }
    try {
        const subteamMembers = await readSubteam(
            api,
            registration.subteamId,
            registration.companyId
        );
        await db
            .update(teamOrganizations)
            .set({ subteamMembers, syncedAt: now })
            .where(eq(teamOrganizations.id, registration.id));
        return { ...registration, subteamMembers, syncedAt: now };
    } catch (error) {
        console.warn(`Failed to resync a subteam: ${describeError(error)}`);
        return registration;
    }
}

/**
 * Whether the user administers the company, asked once a day: undefined
 * while every one of these memberships was checked within a day, or when
 * Onshape won't say, which leaves the stored roles.
 */
async function checkCompanyAdmin(
    db: Db,
    api: OAuthApi,
    companyId: string,
    userId: string,
    teamIds: string[],
    now: Date
): Promise<boolean | undefined> {
    const rows = await db
        .select({ roleCheckedAt: teamMembers.roleCheckedAt })
        .from(teamMembers)
        .where(
            and(
                eq(teamMembers.userId, userId),
                inArray(teamMembers.teamId, teamIds)
            )
        )
        .all();
    if (
        rows.length === teamIds.length &&
        rows.every((row) => !isStale(row.roleCheckedAt, now))
    ) {
        return undefined;
    }
    try {
        return (await getCompany(api, companyId)).admin === true;
    } catch (error) {
        console.warn(
            `Failed to read a company's admins: ${describeError(error)}`
        );
        return undefined;
    }
}
