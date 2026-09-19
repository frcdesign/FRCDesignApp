/**
 * Reading a pasted Onshape url, which is how both the library's groups and the
 * version manager's links are added: copy the address bar, paste it in.
 *
 * A leaf, so the parsing can be tested on its own — `url.tsx`, which builds
 * these urls and opens them, reaches components and notifications.
 */
import { INSTANCE_TYPES, type InstanceType } from "@backend/lib/onshape/path";
import { type WorkspacePath } from "@backend/features/version-manager/contract";

/**
 * What an Onshape url names. Everything past the document is optional: a link
 * to a document carries only its id, while one copied from an open tab carries
 * the instance and the tab as well.
 */
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
 * The path a pasted url names, or undefined when it names no document at all.
 *
 * Onshape's urls run `/documents/{did}/{wvm}/{wvmid}/e/{eid}`, and every
 * segment after the document is dropped rather than half-read: a `/w/` with
 * nothing after it names no instance, so it answers as the document alone.
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

/**
 * The document a pasted url names. Only the id: a link to the document itself
 * carries nothing more, and that is enough to add one to a library.
 */
export function parseOnshapeDocumentId(urlString: string): string | undefined {
    return parseOnshapeUrl(urlString)?.documentId;
}

/**
 * The workspace a pasted url names, or undefined when it names none.
 *
 * Only a workspace will do: the version manager writes to what it is given, and
 * a version or a microversion cannot be written to. A url that stops at the
 * document is refused rather than resolved to the default workspace, which
 * would be a different one than whoever copied the link was looking at.
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
