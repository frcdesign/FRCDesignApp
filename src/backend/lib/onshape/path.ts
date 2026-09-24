/** Both the type and the runtime list derive from this. */
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
        // An unrecognized type builds a path Onshape rejects.
        INSTANCE_TYPES.includes((path as InstancePath).instanceType)
    );
}

export function isElementPath(path: unknown): path is ElementPath {
    return (
        isInstancePath(path) &&
        typeof (path as ElementPath).elementId === "string"
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

/** `{ documentId, workspaceId }`, as API bodies and query params expect. */
function toInstanceApiObject(path: InstancePath): Record<string, string> {
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
