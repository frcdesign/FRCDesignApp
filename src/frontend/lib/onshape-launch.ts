/**
 * What Onshape launches the panel with. Kept for the tab rather than left in the
 * url: the document is the caller's own, so a url carrying it is one nobody can
 * usefully share.
 *
 * A leaf, so the store can declare these fields without reaching the hooks that
 * read them back — those are in `onshape-params`.
 */
import * as z from "zod";
import { ElementType } from "@backend/lib/onshape/element-type";
import { INSTANCE_TYPES, type ElementPath } from "@backend/lib/onshape/path";
import { type WorkspacePath } from "@backend/features/version-manager/contract";

/** A resolved color scheme, as Onshape provides it; Theme adds "system" on top. */
export const ColorThemeType = z.enum(["light", "dark"]);

export type ColorTheme = z.infer<typeof ColorThemeType>;

/**
 * Every field optional: the app is opened standalone as well, and a launch we
 * cannot read in full is one to treat as no launch rather than half of one.
 */
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

/**
 * The element the panel can insert into: a workspace and nothing else, since a
 * version and a microversion are snapshots with nothing to put a part in.
 */
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

/** Whether a launch names a document the app cannot be used in. */
export function isReadOnlyInstance(launch: OnshapeLaunch): boolean {
    return launch.instanceType === "v" || launch.instanceType === "m";
}
