/**
 * Kept per tab rather than in the url, since a url carrying the caller's
 * document isn't shareable. A leaf, so the store can declare these fields.
 */
import * as z from "zod";
import { ElementType } from "@backend/lib/onshape/element-type";
import { INSTANCE_TYPES, type ElementPath } from "@backend/lib/onshape/path";
import { type WorkspacePath } from "@backend/features/version-manager/contract";

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
    /** The company the session is scoped to, which sign-in asks Onshape for. */
    sessionCompanyId: z.string().optional().catch(undefined)
});

export type OnshapeLaunch = z.infer<typeof OnshapeLaunchType>;

/** The url keys a launch occupies. */
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

/**
 * The workspace the version manager acts on. Unlike {@link toTargetElement} it
 * wants no tab: pushing and pulling move the whole workspace's references, and
 * which tab the panel was opened from has nothing to do with it.
 */
export function toTargetWorkspace(
    launch: OnshapeLaunch
): WorkspacePath | undefined {
    const { documentId, instanceId, instanceType } = launch;
    if (!documentId || !instanceId || instanceType !== "w") {
        return undefined;
    }
    return { documentId, instanceId, instanceType };
}
