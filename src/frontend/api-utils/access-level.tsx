import { PropsWithChildren } from "react";
import { hasEditorAccess } from "../../shared/types";
import { hasAdminAccess } from "../../shared/types";
import { AccessLevel } from "../../shared/types";
import { useLoaderData } from "@tanstack/react-router";

interface RequireAccessLevelProps extends PropsWithChildren {
    /**
     * @optional
     * @default AccessLevel.EDITOR
     */
    accessLevel?: AccessLevel;
    /**
     * If specified, this will check against the maxAccessLevel instead of currentAccessLevel.
     * @default false
     */
    useMaxAccessLevel?: boolean;
}

/**
 * Simple component which renders children only if the given accessLevel requirement is met.
 */
export function RequireAccessLevel(props: RequireAccessLevelProps) {
    const loaderData = useLoaderData({ from: "/app" });
    const requiredAccessLevel = props.accessLevel ?? AccessLevel.EDITOR;
    const currentAccessLevel = props.useMaxAccessLevel
        ? loaderData.maxAccessLevel
        : loaderData.currentAccessLevel;

    if (
        requiredAccessLevel === AccessLevel.ADMIN &&
        hasAdminAccess(currentAccessLevel)
    ) {
        return props.children;
    } else if (
        requiredAccessLevel === AccessLevel.EDITOR &&
        hasEditorAccess(currentAccessLevel)
    ) {
        return props.children;
    }
    return null;
}
