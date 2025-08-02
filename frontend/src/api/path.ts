export interface DocumentPath {
    documentId: string;
}

export interface WorkspacePath extends DocumentPath {
    instanceId: string;
}

export type InstanceType = "w" | "v" | "m";

export interface InstancePath extends WorkspacePath {
    /**
     * One of "w", "v", or "m". Defaults to "w".
     */
    instanceType: InstanceType;
}

export interface ElementPath extends InstancePath {
    elementId: string;
}

export function isWorkspacePath(path: DocumentPath): path is WorkspacePath {
    return (<WorkspacePath>path).instanceId !== undefined;
}

export function isInstancePath(path: DocumentPath): path is InstancePath {
    return (
        isWorkspacePath(path) && (<InstancePath>path).instanceType !== undefined
    );
}

export function isElementPath(path: DocumentPath): path is ElementPath {
    return isInstancePath(path) && (<ElementPath>path).elementId !== undefined;
}

export function toDocumentApiPath(path: DocumentPath): string {
    return `/d/${path.documentId}`;
}

export function toInstanceApiPath(path: WorkspacePath): string {
    const instanceType = isInstancePath(path) ? path.instanceType : "w";
    return toDocumentApiPath(path) + `/${instanceType}/${path.instanceId}`;
}

export function toElementApiPath(path: ElementPath): string {
    return toInstanceApiPath(path) + `/e/${path.elementId}`;
}

export interface UserPath {
    userId: string;
}

export function toUserApiPath(path: UserPath): string {
    return `/users/${path.userId}`;
}
