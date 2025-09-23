import { PropsWithChildren } from "react";
import { AccessLevel, hasAdminAccess, hasMemberAccess } from "./models";
import { useSearch } from "@tanstack/react-router";

interface RequireAccessLevelProps extends PropsWithChildren {
    /**
     * @optional
     * @default AccessLevel.MEMBER
     */
    accessLevel?: AccessLevel;
}

/**
 * Simple component which renders children only if the given accessLevel requirement is met.
 */
export function RequireAccessLevel(props: RequireAccessLevelProps) {
    const accessLevel = useSearch({ from: "/app" }).currentAccessLevel;
    const requiredAccessLevel = props.accessLevel ?? AccessLevel.MEMBER;

    if (
        requiredAccessLevel === AccessLevel.ADMIN &&
        hasAdminAccess(accessLevel)
    ) {
        return props.children;
    } else if (
        requiredAccessLevel === AccessLevel.MEMBER &&
        hasMemberAccess(accessLevel)
    ) {
        return props.children;
    }
    return null;
}
