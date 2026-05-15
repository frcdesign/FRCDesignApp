import { createServerFn } from "@tanstack/react-start";
import { Library } from "../api-utils/client-models";
import { OAuthApi } from "../onshape-api/client/oauth-api";
import { AccessLevel, getAccessLevel } from "../onshape-api/endpoints/users";
import { getDocument, getContents } from "../onshape-api/endpoints/documents";
import {
    getThumbnailId,
    ThumbnailSize
} from "../onshape-api/endpoints/thumbnails";
import { ElementPath, InstancePath } from "../onshape-api/path";
import { getLibrary } from "../connect/library";
import { uploadThumbnails } from "../connect/storage";
import { getOnshapeApi } from "../routes/auth/-auth.server";

async function getAppAccessLevel(client: OAuthApi): Promise<AccessLevel> {
    const override = process.env.ACCESS_LEVEL_OVERRIDE;
    if (override) return override as AccessLevel;

    const adminTeam = process.env.ADMIN_TEAM;
    if (!adminTeam)
        throw new Error(
            "ADMIN_TEAM or ACCESS_LEVEL_OVERRIDE must be configured"
        );

    return getAccessLevel(client, adminTeam);
}

async function requireAccess(
    onshapeApi: OAuthApi,
    required: AccessLevel = AccessLevel.EDITOR
): Promise<void> {
    const level = await getAppAccessLevel(onshapeApi);
    if (
        required === AccessLevel.EDITOR &&
        (level === AccessLevel.EDITOR || level === AccessLevel.ADMIN)
    )
        return;
    if (required === AccessLevel.ADMIN && level === AccessLevel.ADMIN) return;
    throw new Error("Insufficient permissions");
}

/**
 * Determines the element to use for a document thumbnail.
 * Falls back to the first element if `documentThumbnailElementId` is unset.
 */
function getThumbnailElementId(document: any, contents: any): string {
    const thumbnailElementId: string = document.documentThumbnailElementId;
    if (thumbnailElementId) return thumbnailElementId;

    const elements: any[] = contents.elements;
    if (elements.length < 1)
        throw new Error(
            `Document ${document.name} has no elements to use as a thumbnail.`
        );
    return elements[0].id;
}

function getThumbnailMicroversionId(
    contents: any,
    thumbnailElementId: string
): string {
    const element = (contents.elements as any[]).find(
        (e) => e.id === thumbnailElementId
    );
    if (!element)
        throw new Error("Unexpectedly failed to find the thumbnail element.");
    return element.microversionId;
}

async function uploadDocumentThumbnails(
    onshapeApi: OAuthApi,
    document: any,
    contents: any,
    versionPath: InstancePath
): Promise<Partial<Record<ThumbnailSize, string>>> {
    const thumbnailElementId = getThumbnailElementId(document, contents);
    const thumbnailPath: ElementPath = {
        ...versionPath,
        elementId: thumbnailElementId
    };
    const microversionId = getThumbnailMicroversionId(
        contents,
        thumbnailElementId
    );
    return uploadThumbnails(onshapeApi, thumbnailPath, microversionId);
}

// --- Server functions ---

/**
 * Reloads and re-uploads the thumbnail for a document.
 * Requires MEMBER-level access.
 */
export const reloadDocumentThumbnail = createServerFn()
    .inputValidator(
        (data: { library: Library; instancePath: InstancePath }) => data
    )
    .handler(async ({ data: { library, instancePath } }) => {
        const onshapeApi = await getOnshapeApi();
        await requireAccess(onshapeApi);

        const [document, contents] = await Promise.all([
            getDocument(onshapeApi, instancePath),
            getContents(onshapeApi, instancePath)
        ]);

        const thumbnails = await uploadDocumentThumbnails(
            onshapeApi,
            document,
            contents,
            instancePath
        );

        if (Object.keys(thumbnails).length < 2) {
            throw new Error(
                "Failed to upload thumbnail. Does it exist in Onshape?"
            );
        }

        const documentRef = getLibrary(library).documents.document(
            instancePath.documentId
        );
        const existing = await documentRef.get();
        if (
            JSON.stringify(existing?.thumbnailUrls) ===
            JSON.stringify(thumbnails)
        ) {
            throw new Error("Thumbnail is already up to date.");
        }

        await documentRef.update({ thumbnailUrls: thumbnails });
        return { success: true };
    });

/**
 * Reloads and re-uploads the thumbnail for an element.
 * Requires MEMBER-level access.
 */
export const reloadElementThumbnail = createServerFn()
    .inputValidator(
        (data: { library: Library; elementPath: ElementPath }) => data
    )
    .handler(async ({ data: { library, elementPath } }) => {
        const onshapeApi = await getOnshapeApi();
        await requireAccess(onshapeApi);

        const elementRef = getLibrary(library)
            .documents.document(elementPath.documentId)
            .elements.element(elementPath.elementId);

        const element = await elementRef.get();
        if (!element) throw new Error("Element not found");

        const thumbnails = await uploadThumbnails(
            onshapeApi,
            elementPath,
            element.microversionId
        );
        if (Object.keys(thumbnails).length < 2) {
            throw new Error(
                "Failed to upload thumbnail. Does it exist in Onshape?"
            );
        }

        if (
            JSON.stringify(element.thumbnailUrls) === JSON.stringify(thumbnails)
        ) {
            throw new Error("Thumbnail is already up to date.");
        }

        await elementRef.update({ thumbnailUrls: thumbnails });
        return { success: true };
    });

/**
 * Returns the predictable thumbnail ID for a given element, optionally with a specific configuration.
 *
 * The thumbnail ID can be polled — Onshape generates it asynchronously and may not return immediately.
 */
export const fetchThumbnailId = createServerFn()
    .inputValidator(
        (data: { elementPath: ElementPath; configuration?: string }) => data
    )
    .handler(
        async ({
            data: { elementPath, configuration }
        }): Promise<{ thumbnailId: string }> => {
            const onshapeApi = await getOnshapeApi();
            const thumbnailId = await getThumbnailId(
                onshapeApi,
                elementPath,
                configuration
            );
            return { thumbnailId };
        }
    );
