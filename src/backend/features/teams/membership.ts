/** Membership is proven by a launch: editing an organization's document joins its team. */
import { getDb } from "../../db/client";
import { type AppContext } from "../../lib/context";
import { describeError } from "../../lib/error-text";
import { OnshapePermission } from "../../lib/onshape/endpoints/permissions";
import {
    OnshapeOwnerType,
    type OnshapeDocumentInfo
} from "../../lib/onshape/types";
import { PERSONAL_COMPANY_ID } from "../auth/personal-company";
import { OrganizationKind, TeamRole } from "./contract";
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

/** Every team the organization registered for all its editors, or for a subteam the user is in. */
async function joinOrganizationTeams(
    c: AppContext,
    companyId: string,
    userId: string
): Promise<void> {
    const db = getDb(c.env.DB);
    const registrations = await getOrganizationRegistrations(db, companyId);
    const now = new Date();
    const joins = registrations
        .filter(
            (registration) =>
                registration.subteamId === "" ||
                registration.subteamMembers.includes(userId)
        )
        .map((registration) =>
            upsertMember(db, registration.teamId, userId, TeamRole.MEMBER, now)
        );
    if (joins.length > 0) {
        await db.batch([joins[0], ...joins.slice(1)]);
    }
}
