import { Selection } from "../../features/configurations/contract";

/** The instance kinds an Onshape path can address, as one definition: the type
 * and the runtime list validators check against both derive from it. */
export const INSTANCE_TYPES = ["w", "v", "m"] as const;

export type InstanceType = (typeof INSTANCE_TYPES)[number];

export interface DocumentPath {
    documentId: string;
}

export interface InstancePath extends DocumentPath {
    instanceId: string;
    instanceType: InstanceType;
}

export interface ElementPath extends InstancePath {
    elementId: string;
}

/** Represents a part inside a Part Studio. */

/** The version-pinned tab a stored insertable row addresses. */
export function toElementPath(row: {
    documentId: string;
    versionId: string;
    elementId: string;
}): ElementPath {
    return {
        documentId: row.documentId,
        instanceId: row.versionId,
        instanceType: "v",
        elementId: row.elementId
    };
}

export interface ConfigurablePath extends ElementPath {
    selection: Selection;
}

function isDocumentPath(path: unknown): path is DocumentPath {
    return (
        typeof path === "object" &&
        path !== null &&
        typeof (path as DocumentPath).documentId === "string"
    );
}

export function isInstancePath(path: unknown): path is InstancePath {
    return (
        isDocumentPath(path) &&
        typeof (path as InstancePath).instanceId === "string" &&
        // Checked against the literals: an unrecognized instance type builds a
        // path Onshape rejects, which is worth catching at the boundary.
        INSTANCE_TYPES.includes((path as InstancePath).instanceType)
    );
}

export function isElementPath(path: unknown): path is ElementPath {
    return (
        isInstancePath(path) &&
        typeof (path as ElementPath).elementId === "string"
    );
}

export function isConfigurablePath(
    path: DocumentPath
): path is ConfigurablePath {
    return (
        isElementPath(path) &&
        (path as ConfigurablePath).selection !== undefined
    );
}

export function toDocumentApiPath(path: DocumentPath): string {
    return `/d/${path.documentId}`;
}

export function toInstanceApiPath(path: InstancePath): string {
    return `${toDocumentApiPath(path)}/${path.instanceType}/${path.instanceId}`;
}

export function toElementApiPath(path: ElementPath): string {
    return `${toInstanceApiPath(path)}/e/${path.elementId}`;
}

type InstanceTypeKey = "workspaceId" | "versionId" | "microversionId";

function toInstanceTypeKey(instanceType: InstanceType): InstanceTypeKey {
    switch (instanceType) {
        case "w":
            return "workspaceId";
        case "v":
            return "versionId";
        case "m":
            return "microversionId";
    }
}

/**
 * Returns the named-ID object that Onshape API bodies/query params expect,
 * e.g. `{ documentId, workspaceId }` rather than the `/d/.../w/...` path form.
 */
function toInstanceApiObject(
    path: InstancePath
): Record<string, string> {
    return {
        documentId: path.documentId,
        [toInstanceTypeKey(path.instanceType)]: path.instanceId
    };
}

export function toElementApiObject(path: ElementPath): Record<string, string> {
    return {
        ...toInstanceApiObject(path),
        elementId: path.elementId
    };
}
