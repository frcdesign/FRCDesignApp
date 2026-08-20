/** The permission tiers the app grants, and the predicates routes gate on. */
export enum AccessLevel {
    ADMIN = "admin",
    EDITOR = "editor",
    USER = "user"
}

export function hasAdminAccess(accessLevel: AccessLevel) {
    return accessLevel === AccessLevel.ADMIN;
}

export function hasEditorAccess(accessLevel: AccessLevel) {
    return (
        accessLevel === AccessLevel.ADMIN || accessLevel === AccessLevel.EDITOR
    );
}

export function hasUserAccess(accessLevel: AccessLevel) {
    return accessLevel === AccessLevel.USER;
}

const ACCESS_LEVEL_RANK: Record<AccessLevel, number> = {
    [AccessLevel.USER]: 0,
    [AccessLevel.EDITOR]: 1,
    [AccessLevel.ADMIN]: 2
};

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
