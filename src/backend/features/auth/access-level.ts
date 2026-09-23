/** The permission tiers the app grants, and the predicates routes gate on. */
export enum AccessLevel {
    /**
     * The one Onshape user named by `OWNER_USER_ID`: an admin whose session the
     * server borrows for work nobody asked for, like a webhook's reload.
     */
    OWNER = "owner",
    ADMIN = "admin",
    EDITOR = "editor",
    USER = "user"
}

const ACCESS_LEVEL_RANK: Record<AccessLevel, number> = {
    [AccessLevel.USER]: 0,
    [AccessLevel.EDITOR]: 1,
    [AccessLevel.ADMIN]: 2,
    [AccessLevel.OWNER]: 3
};

export function hasEditorAccess(accessLevel: AccessLevel) {
    return isWithinAccessLevel(AccessLevel.EDITOR, accessLevel);
}

/** Whether `accessLevel` grants no more than `maxAccessLevel` does. */
export function isWithinAccessLevel(
    accessLevel: AccessLevel,
    maxAccessLevel: AccessLevel
): boolean {
    return ACCESS_LEVEL_RANK[accessLevel] <= ACCESS_LEVEL_RANK[maxAccessLevel];
}

/**
 * Server-provided access: the highest level granted plus sign-in state. The
 * level the app is currently viewed as is client-side (see useAccessData).
 */
export interface AccessData {
    maxAccessLevel: AccessLevel;
    signedIn: boolean;
}
