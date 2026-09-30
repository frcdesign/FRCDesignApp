/** Reading a pasted Onshape url. A leaf, so the parsing can be tested alone. */
import { INSTANCE_TYPES, type InstanceType } from "@backend/lib/onshape/path";
import { type WorkspacePath } from "@backend/features/version-manager/contract";

/** What an Onshape url names. A link to a document carries only its id. */
export interface OnshapeUrlPath {
    documentId: string;
    instanceType?: InstanceType;
    instanceId?: string;
    elementId?: string;
}

/** What to say to somebody whose paste did not name an Onshape document. */
export const INVALID_DOCUMENT_URL =
    "That does not look like a link to an Onshape document. Copy the url from the document's address bar.";

/** The same, where only a workspace will do. */
export const INVALID_WORKSPACE_URL =
    "That does not look like a link to an Onshape workspace. Copy the url from the document's address bar.";

/**
 * The path a pasted url names, or undefined when it names no document. Onshape's
 * urls run `/documents/{did}/{wvm}/{wvmid}/e/{eid}`; a segment with nothing
 * after it is dropped.
 */
export function parseOnshapeUrl(urlString: string): OnshapeUrlPath | undefined {
    const url = URL.parse(urlString);
    if (!url) {
        return undefined;
    }
    const [, documents, documentId, instanceType, instanceId, e, elementId] =
        url.pathname.split("/");
    if (documents !== "documents" || !documentId) {
        return undefined;
    }

    const path: OnshapeUrlPath = { documentId };
    if (isInstanceType(instanceType) && instanceId) {
        path.instanceType = instanceType;
        path.instanceId = instanceId;
        if (e === "e" && elementId) {
            path.elementId = elementId;
        }
    }
    return path;
}

function isInstanceType(value: string | undefined): value is InstanceType {
    return INSTANCE_TYPES.includes(value as InstanceType);
}

/** The document a pasted url names, which is enough to add one to a library. */
export function parseOnshapeDocumentId(urlString: string): string | undefined {
    return parseOnshapeUrl(urlString)?.documentId;
}

/**
 * The workspace a pasted url names, or undefined when it names none: a version
 * cannot be written to, and a url that stops at the document may not mean its
 * default workspace.
 */
export function parseOnshapeWorkspace(
    urlString: string
): WorkspacePath | undefined {
    const path = parseOnshapeUrl(urlString);
    if (path?.instanceType !== "w" || !path.instanceId) {
        return undefined;
    }
    return {
        documentId: path.documentId,
        instanceId: path.instanceId,
        instanceType: "w"
    };
}
