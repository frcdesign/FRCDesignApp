import { PropsWithChildren } from "react";
import {
    AccessLevel,
    isWithinAccessLevel
} from "@backend/features/auth/access-level";
import { useAccessData, useIsSignedIn } from "../access-level";

interface RequireAccessLevelProps extends PropsWithChildren {
    /** @default AccessLevel.EDITOR */
    accessLevel?: AccessLevel;
    /** Check against maxAccessLevel instead of the viewed level. @default false */
    useMaxAccessLevel?: boolean;
}

export function RequireAccessLevel(props: RequireAccessLevelProps) {
    const {
        accessLevel = AccessLevel.EDITOR,
        useMaxAccessLevel = false,
        children
    } = props;
    const accessData = useAccessData();
    const currentAccessLevel = useMaxAccessLevel
        ? accessData.maxAccessLevel
        : accessData.currentAccessLevel;

    // Reads backwards: the level held is the ceiling the requirement fits under.
    return isWithinAccessLevel(accessLevel, currentAccessLevel)
        ? children
        : null;
}

export function RequireSignIn(props: PropsWithChildren) {
    return useIsSignedIn() ? props.children : null;
}
