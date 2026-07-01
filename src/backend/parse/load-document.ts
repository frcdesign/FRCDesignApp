import {
    WorkflowEntrypoint,
    WorkflowEvent,
    WorkflowStep
} from "cloudflare:workers";
import type { AppBindings } from "../app";
import { getOnshapeApiForSessionId } from "../auth";
import { getDb } from "../db";
import type { ElementPath, InstancePath } from "../../shared/onshape-path";
import { type FastenInfo, type ThumbnailUrls } from "../../shared/types";
import {
    uploadThumbnails,
    uploadDocumentThumbnails
} from "../routes/thumbnails";
import { parseVendors } from "./parse-vendors";
import { bumpLibraryVersion, rebuildSearchDb } from "../library-data";
import {
    fetchContents,
    fetchExistingInsertables,
    fetchGroup,
    loadElementConfiguration,
    loadElementFasten,
    matchElements,
    saveDocument,
    selectReloads,
    type LoadedElement,
    type MatchedElement,
    type VersionInfo
} from "./load-document-steps";

export interface LoadDocumentParams {
    /** The group to sync — must already exist (see `createOrderedGroup`). */
    groupId: string;
    sessionId: string;
    /** The document version to sync to; the caller decides this is worth syncing. */
    version: VersionInfo;
    forceReload?: boolean;
}

/**
 * Syncs an Onshape document into the library database.
 *
 * `run()` is a thin orchestrator: each `step.do` resolves its dependencies (the
 * Onshape client / D1) and delegates to a step function in `./load-document-steps`,
 * which holds the testable logic and the explicit per-element data flow.
 */
export class LoadDocumentWorkflow extends WorkflowEntrypoint<
    AppBindings,
    LoadDocumentParams
> {
    async run(
        event: WorkflowEvent<LoadDocumentParams>,
        step: WorkflowStep
    ): Promise<void> {
        const {
            groupId,
            sessionId,
            version,
            forceReload = false
        } = event.payload;

        // Look up the group's document/library (the caller already created the row).
        const { documentId, libraryId } = await step.do(
            "load-group",
            async () => {
                const db = getDb(this.env.DB);
                return fetchGroup(db, groupId);
            }
        );

        const instancePath: InstancePath = {
            documentId,
            instanceId: version.instanceId,
            instanceType: "v"
        };

        // Fetch document contents (metadata + the valid elements, in order).
        const docInfo = await step.do("fetch-contents", async () => {
            const api = await getOnshapeApiForSessionId(this.env.KV, sessionId);
            return fetchContents(api, instancePath);
        });

        // Match each element to an existing insertable, assigning fresh ids to new
        // elements. Ids are generated here (inside the step) so replays are stable.
        const matched = await step.do("match-elements", async () => {
            const db = getDb(this.env.DB);
            const existing = await fetchExistingInsertables(db, groupId);
            return matchElements(docInfo, existing, () => crypto.randomUUID());
        });

        // Upload document-level thumbnails (with retry).
        const docThumbnailUrls = await this.uploadThumbnailsWithRetry(
            step,
            `doc-thumbnail-${documentId}`,
            async () => {
                const api = await getOnshapeApiForSessionId(
                    this.env.KV,
                    sessionId
                );
                return uploadDocumentThumbnails(
                    this.env.THUMBNAILS,
                    api,
                    instancePath
                );
            }
        );

        // Load the elements that need reloading.
        const loaded = await Promise.all(
            selectReloads(matched, forceReload).map((element) =>
                this.loadElement(step, sessionId, instancePath, element)
            )
        );

        // Persist everything.
        await step.do("save-to-db", async () => {
            const db = getDb(this.env.DB);
            await saveDocument(db, {
                groupId,
                documentId,
                libraryId,
                version,
                docInfo,
                docThumbnailUrls,
                loaded
            });
        });

        // Rebuild the library's search index and bump the cache version.
        await step.do("rebuild-search-db", async () => {
            const db = getDb(this.env.DB);
            await rebuildSearchDb(db, libraryId);
            await bumpLibraryVersion(db, libraryId);
        });
    }

    private async loadElement(
        step: WorkflowStep,
        sessionId: string,
        instancePath: InstancePath,
        matched: MatchedElement
    ): Promise<LoadedElement> {
        const { elementId, elementType, microversionId, name } =
            matched.element;
        const elementPath: ElementPath = { ...instancePath, elementId };

        // Fasten info (fasten info crosses the step boundary as a JSON string).
        const fastenData = await step.do(
            `load-element-${elementId}`,
            async () => {
                const api = await getOnshapeApiForSessionId(
                    this.env.KV,
                    sessionId
                );
                return loadElementFasten(
                    api,
                    elementPath,
                    elementType,
                    matched.supportsFasten
                );
            }
        );

        // Configuration (separate step for future extensibility).
        const configData = await step.do(
            `load-configuration-${elementId}`,
            async () => {
                const api = await getOnshapeApiForSessionId(
                    this.env.KV,
                    sessionId
                );
                return loadElementConfiguration(api, elementPath, name);
            }
        );

        const thumbnailUrls = await this.uploadThumbnailsWithRetry(
            step,
            `element-thumbnail-${elementId}`,
            async () => {
                const api = await getOnshapeApiForSessionId(
                    this.env.KV,
                    sessionId
                );
                return uploadThumbnails(
                    this.env.THUMBNAILS,
                    api,
                    elementPath,
                    microversionId
                );
            }
        );

        return {
            matched,
            fastenInfo: fastenData.fastenInfo
                ? (JSON.parse(fastenData.fastenInfo) as FastenInfo)
                : null,
            supportsFasten: fastenData.supportsFasten,
            vendors: configData ? configData.vendors : parseVendors(name),
            configuration: configData ? configData.parameters : null,
            thumbnailUrls
        };
    }

    private async uploadThumbnailsWithRetry(
        step: WorkflowStep,
        prefix: string,
        uploadFn: () => Promise<ThumbnailUrls | null>
    ): Promise<ThumbnailUrls | null> {
        const tryUpload = (n: number) => {
            return step.do(
                `${prefix}-${n}`,
                { retries: { limit: 0, delay: 0, backoff: "constant" } },
                uploadFn
            );
        };

        let thumbnails = await tryUpload(1);
        if (thumbnails) return thumbnails;
        await step.sleep(`${prefix}-wait-1`, "5 seconds");
        thumbnails = await tryUpload(2);
        if (thumbnails) return thumbnails;

        await step.sleep(`${prefix}-wait-2`, "5 minutes");
        thumbnails = await tryUpload(3);
        if (thumbnails) return thumbnails;

        await step.sleep(`${prefix}-wait-3`, "5 minutes");
        return await tryUpload(4);
    }
}
