export type InstanceType = "w" | "v" | "m";

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
export interface PartPath extends ElementPath {
    partId: string;
}

export function isDocumentPath(path: any): path is DocumentPath {
    return (
        typeof path === "object" &&
        path !== null &&
        typeof path.documentId === "string"
    );
}

export function isInstancePath(path: any): path is InstancePath {
    return (
        isDocumentPath(path) &&
        (path as InstancePath).instanceId !== undefined &&
        (path as InstancePath).instanceType !== undefined
    );
}

export function isElementPath(path: any): path is ElementPath {
    return (
        isInstancePath(path) && (path as ElementPath).elementId !== undefined
    );
}

export function isPartPath(path: DocumentPath): path is PartPath {
    return isElementPath(path) && (path as PartPath).partId !== undefined;
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

export type InstanceTypeKey = "workspaceId" | "versionId" | "microversionId";

export function toInstanceTypeKey(instanceType: InstanceType): InstanceTypeKey {
    switch (instanceType) {
        case "w":
            return "workspaceId";
        case "v":
            return "versionId";
        case "m":
            return "microversionId";
    }
}

export function toDocumentApiObject(path: DocumentPath): {
    documentId: string;
} {
    return { documentId: path.documentId };
}

/**
 * Returns the named-ID object that Onshape API bodies/query params expect,
 * e.g. `{ documentId, workspaceId }` rather than the `/d/.../w/...` path form.
 */
export function toInstanceApiObject(
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
