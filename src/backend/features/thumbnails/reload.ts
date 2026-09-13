/**
 * Re-fetching one stored thumbnail on demand.
 *
 * A load queues nothing and waits for nothing, so a thumbnail neither instance
 * would give up at the time is simply missing until the next load. This is the
 * way to ask again for one, without reloading the document it belongs to.
 */
import { eq } from "drizzle-orm";
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
import { type ElementPath, type InstancePath } from "../../lib/onshape/path";
import { handledError } from "../../lib/api-error";
import { HttpStatus } from "http-status-ts";
import { ThumbnailSize, type ThumbnailUrls } from "./contract";
import { thumbnailKey } from "./keys";
import { uploadThumbnails } from "./store";
import { bumpLibraryVersion } from "../library/db";
import type { OnshapeDocumentInfo } from "../../lib/onshape/types";

/** What one reload needs to ask Onshape and to name what it stores. */
interface ReloadTarget {
    elementPath: ElementPath;
    elementWorkspacePath: ElementPath;
    microversionId: string;
}

/**
 * The document's workspace, which is where a thumbnail falls back to. Stored
 * rows are pinned to a version and carry no workspace, so reading the document
 * is the one thing a reload has to do before it can ask for the picture.
 */
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

/**
 * Drops what is stored before fetching, since `uploadThumbnails` skips a size
 * the bucket already holds — which is the whole point of asking again.
 */
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
    return uploadThumbnails(
        bucket,
        onshapeApi,
        elementPath,
        target.elementWorkspacePath,
        microversionId
    );
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
    insertableId: string
): Promise<void> {
    const row = await db
        .select({
            libraryId: insertables.libraryId,
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            elementId: insertables.elementId,
            microversionId: insertables.microversionId,
            buildIssues: insertables.buildIssues
        })
        .from(insertables)
        .where(eq(insertables.id, insertableId))
        .get();
    if (!row) {
        throw handledError("No such element.", HttpStatus.NOT_FOUND);
    }

    const document = await getDocument(onshapeApi, {
        documentId: row.documentId
    });
    const workspace = workspacePath(document, row.documentId);
    const urls = await replaceThumbnails(bucket, onshapeApi, {
        elementPath: {
            documentId: row.documentId,
            instanceId: row.versionId,
            instanceType: "v",
            elementId: row.elementId
        },
        elementWorkspacePath: { ...workspace, elementId: row.elementId },
        microversionId: row.microversionId
    });

    await db
        .update(insertables)
        .set(reloaded(urls, row.buildIssues))
        .where(eq(insertables.id, insertableId));
    // The urls are unchanged — they are built from the element and its
    // microversion — so this is for the build issue the row no longer has.
    await bumpLibraryVersion(db, row.libraryId);
}

/**
 * Re-fetches a group's own thumbnail. Which element it comes from is the
 * document's to say, so unlike an insertable's this has to read the contents
 * to find it and the microversion its key is built on.
 */
export async function reloadGroupThumbnail(
    db: Db,
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    groupId: string
): Promise<void> {
    const row = await db
        .select({
            libraryId: groups.libraryId,
            documentId: groups.documentId,
            versionId: groups.versionId,
            buildIssues: groups.buildIssues
        })
        .from(groups)
        .where(eq(groups.id, groupId))
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
    await bumpLibraryVersion(db, row.libraryId);
}
