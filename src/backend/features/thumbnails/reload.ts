import { and, eq } from "drizzle-orm";
import { type Db } from "../../db/client";
import { groups, insertables } from "../../db/schema";
import {
    type BuildIssue,
    BuildIssueType,
    clearBuildIssue
} from "../build-checker/issues";
import {
    getContents,
    getDocument
} from "../../lib/onshape/endpoints/documents";
import { type OnshapeApi } from "../../lib/onshape/client";
import {
    type ElementPath,
    type InstancePath,
    toElementPath
} from "../../lib/onshape/path";
import { handledError } from "../../lib/api-error";
import { HttpStatus } from "http-status-ts";
import { ThumbnailSize, type ThumbnailUrls } from "./contract";
import { thumbnailKey } from "./keys";
import { uploadThumbnails } from "./store";
import { bumpLibraryVersion } from "../library/db";
import type { LibraryId } from "../library/library-id";
import type { OnshapeDocumentInfo } from "../../lib/onshape/types";

/** What one reload needs to ask Onshape and to name what it stores. */
interface ReloadTarget {
    elementPath: ElementPath;
    elementWorkspacePath: ElementPath;
    microversionId: string;
}

/** Where a thumbnail the version won't give up is read; rows carry only the version. */
function workspacePath(
    document: OnshapeDocumentInfo,
    documentId: string
): InstancePath {
    if (!document.defaultWorkspace) {
        throw handledError(
            "Onshape reports no default workspace for this document.",
            HttpStatus.BAD_GATEWAY
        );
    }
    return {
        documentId,
        instanceId: document.defaultWorkspace.id,
        instanceType: "w"
    };
}

/** Deletes first, since `uploadThumbnails` skips stored sizes. */
async function replaceThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    target: ReloadTarget
): Promise<ThumbnailUrls> {
    const { elementPath, microversionId } = target;
    await bucket.delete(
        [ThumbnailSize.SMALL, ThumbnailSize.LARGE].map((size) =>
            thumbnailKey(elementPath.elementId, microversionId, size)
        )
    );
    try {
        return await uploadThumbnails(
            bucket,
            onshapeApi,
            elementPath,
            target.elementWorkspacePath,
            microversionId
        );
    } catch {
        throw handledError(
            "Onshape has not rendered this thumbnail yet. Try again in a few minutes.",
            HttpStatus.SERVICE_UNAVAILABLE
        );
    }
}

/** The row's new urls, and the issue that said it had none. */
function reloaded(urls: ThumbnailUrls, buildIssues: BuildIssue[]) {
    return {
        smallThumbnailUrl: urls.small,
        largeThumbnailUrl: urls.large,
        buildIssues: clearBuildIssue(
            buildIssues,
            BuildIssueType.THUMBNAIL_FAILED
        )
    };
}

/** Re-fetches one insertable's thumbnails and records them on its row. */
export async function reloadInsertableThumbnail(
    db: Db,
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    libraryId: LibraryId,
    insertableId: string
): Promise<void> {
    const row = await db
        .select({
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            elementId: insertables.elementId,
            microversionId: insertables.microversionId,
            buildIssues: insertables.buildIssues
        })
        .from(insertables)
        .where(
            and(
                eq(insertables.id, insertableId),
                eq(insertables.libraryId, libraryId)
            )
        )
        .get();
    if (!row) {
        throw handledError("No such element.", HttpStatus.NOT_FOUND);
    }

    const document = await getDocument(onshapeApi, {
        documentId: row.documentId
    });
    const workspace = workspacePath(document, row.documentId);
    const urls = await replaceThumbnails(bucket, onshapeApi, {
        elementPath: toElementPath(row),
        elementWorkspacePath: { ...workspace, elementId: row.elementId },
        microversionId: row.microversionId
    });

    await db
        .update(insertables)
        .set(reloaded(urls, row.buildIssues))
        .where(eq(insertables.id, insertableId));
    // The urls don't change; this clears the build issue.
    await bumpLibraryVersion(db, libraryId);
}

/** Reads the document's contents to find the element and microversion. */
export async function reloadGroupThumbnail(
    db: Db,
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    libraryId: LibraryId,
    groupId: string
): Promise<void> {
    const row = await db
        .select({
            documentId: groups.documentId,
            versionId: groups.versionId,
            buildIssues: groups.buildIssues
        })
        .from(groups)
        .where(and(eq(groups.id, groupId), eq(groups.libraryId, libraryId)))
        .get();
    if (!row) {
        throw handledError("No such group.", HttpStatus.NOT_FOUND);
    }

    const versionPath: InstancePath = {
        documentId: row.documentId,
        instanceId: row.versionId,
        instanceType: "v"
    };
    const [document, contents] = await Promise.all([
        getDocument(onshapeApi, { documentId: row.documentId }),
        getContents(onshapeApi, versionPath)
    ]);
    const workspace = workspacePath(document, row.documentId);

    const designated = document.documentThumbnailElementId;
    const element = designated
        ? contents.elements.find((entry) => entry.id === designated)
        : contents.elements[0];
    if (!element) {
        throw handledError(
            "This document has no element to take a thumbnail from.",
            HttpStatus.BAD_GATEWAY
        );
    }

    const urls = await replaceThumbnails(bucket, onshapeApi, {
        elementPath: { ...versionPath, elementId: element.id },
        elementWorkspacePath: { ...workspace, elementId: element.id },
        microversionId: element.microversionId
    });

    await db
        .update(groups)
        .set(reloaded(urls, row.buildIssues))
        .where(eq(groups.id, groupId));
    await bumpLibraryVersion(db, libraryId);
}
