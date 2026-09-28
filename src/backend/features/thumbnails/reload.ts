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
import { type ElementPath, type InstancePath } from "../../lib/onshape/path";
import { handledError } from "../../lib/api-error";
import { HttpStatus } from "http-status-ts";
import { ThumbnailSize, type ThumbnailUrls } from "./contract";
import { thumbnailKey } from "./keys";
import { uploadThumbnails } from "./store";
import { bumpLibraryVersion } from "../library/db";
import { syncThumbnailWorkspace } from "./workspace";
import type { LibraryId } from "../library/library-id";

/** What one reload needs to ask Onshape and to name what it stores. */
interface ReloadTarget {
    thumbnailPath: ElementPath;
    microversionId: string;
}

/** The workspace branched off the group's version, recorded on its row. */
async function thumbnailWorkspace(
    db: Db,
    onshapeApi: OnshapeApi,
    group: { id: string; documentId: string; versionId: string },
    stored: string | null
): Promise<InstancePath> {
    const workspace = await syncThumbnailWorkspace(onshapeApi, {
        documentId: group.documentId,
        instanceId: group.versionId,
        instanceType: "v"
    });
    if (workspace.instanceId !== stored) {
        await db
            .update(groups)
            .set({ thumbnailWorkspaceId: workspace.instanceId })
            .where(eq(groups.id, group.id));
    }
    return workspace;
}

/** Deletes first, since `uploadThumbnails` skips stored sizes. */
async function replaceThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    target: ReloadTarget
): Promise<ThumbnailUrls> {
    const { thumbnailPath, microversionId } = target;
    await bucket.delete(
        [ThumbnailSize.SMALL, ThumbnailSize.LARGE].map((size) =>
            thumbnailKey(thumbnailPath.elementId, microversionId, size)
        )
    );
    try {
        return await uploadThumbnails(
            bucket,
            onshapeApi,
            thumbnailPath,
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
            groupId: insertables.groupId,
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            elementId: insertables.elementId,
            microversionId: insertables.microversionId,
            buildIssues: insertables.buildIssues,
            thumbnailWorkspaceId: groups.thumbnailWorkspaceId
        })
        .from(insertables)
        .innerJoin(groups, eq(groups.id, insertables.groupId))
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

    const workspace = await thumbnailWorkspace(
        db,
        onshapeApi,
        { ...row, id: row.groupId },
        row.thumbnailWorkspaceId
    );
    const urls = await replaceThumbnails(bucket, onshapeApi, {
        thumbnailPath: { ...workspace, elementId: row.elementId },
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
            buildIssues: groups.buildIssues,
            thumbnailWorkspaceId: groups.thumbnailWorkspaceId
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
    const workspace = await thumbnailWorkspace(
        db,
        onshapeApi,
        { ...row, id: groupId },
        row.thumbnailWorkspaceId
    );

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
        thumbnailPath: { ...workspace, elementId: element.id },
        microversionId: element.microversionId
    });

    await db
        .update(groups)
        .set(reloaded(urls, row.buildIssues))
        .where(eq(groups.id, groupId));
    await bumpLibraryVersion(db, libraryId);
}
