/**
 * Kept per tab rather than in the url, since a url carrying the caller's
 * document isn't shareable. A leaf, so the store can declare these fields.
 */
import * as z from "zod";
import { ElementType } from "@backend/lib/onshape/element-type";
import { INSTANCE_TYPES, type ElementPath } from "@backend/lib/onshape/path";

/** A resolved color scheme, as Onshape provides it; Theme adds "system" on top. */
const ColorThemeType = z.enum(["light", "dark"]);

export type ColorTheme = z.infer<typeof ColorThemeType>;

/** All optional, since the app also opens standalone. */
export const OnshapeLaunchType = z.object({
    documentId: z.string().optional().catch(undefined),
    instanceId: z.string().optional().catch(undefined),
    instanceType: z.enum(INSTANCE_TYPES).optional().catch(undefined),
    elementId: z.string().optional().catch(undefined),
    /** The tab kind, which decides whether a part is inserted or derived. */
    elementType: z.enum(ElementType).optional().catch(undefined),
    /** Onshape's own origin, which a client message has to be addressed to. */
    server: z.string().optional().catch(undefined),
    /** Onshape's color scheme, which "system" resolves to inside the panel. */
    systemTheme: ColorThemeType.optional().catch(undefined)
});

export type OnshapeLaunch = z.infer<typeof OnshapeLaunchType>;

/** The url keys a launch occupies, which the app strips once it has them. */
export const LAUNCH_KEYS = Object.keys(
    OnshapeLaunchType.shape
) as (keyof OnshapeLaunch)[];

export interface TargetElement extends ElementPath {
    elementType: ElementType;
}

/** Only a workspace; a version can't be inserted into. */
export function toTargetElement(
    launch: OnshapeLaunch
): TargetElement | undefined {
    const { documentId, instanceId, instanceType, elementId, elementType } =
        launch;
    if (
        !documentId ||
        !instanceId ||
        instanceType !== "w" ||
        !elementId ||
        !elementType
    ) {
        return undefined;
    }
    return { documentId, instanceId, instanceType, elementId, elementType };
}

/** Whether a launch names a document the app cannot be used in. */
export function isReadOnlyInstance(launch: OnshapeLaunch): boolean {
    return launch.instanceType === "v" || launch.instanceType === "m";
}
