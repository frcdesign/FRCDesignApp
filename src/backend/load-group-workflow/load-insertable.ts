import type { WorkflowStep } from "cloudflare:workers";
import type { AppBindings } from "../app";
import { getOnshapeApiForSessionId } from "../auth";
import { conflictUpdateSet, getDb } from "../db";
import type { ElementPath } from "../../shared/onshape-path";
import type { ParameterObj } from "../../shared/configuration-models";
import {
    ElementType,
    type FastenInfo,
    type LibraryId,
    type ThumbnailUrls,
    type Vendor
} from "../../shared/types";
import { configurations, insertables } from "../../shared/schema";
import {
    uploadThumbnails,
    uploadThumbnailsWithRetry
} from "../routes/thumbnails";
import { getConfiguration } from "../onshape-api/endpoints/configurations";
import { OnshapeApi } from "../onshape-api/onshape-api";
import { parseOnshapeConfiguration } from "../parse/parse-configuration";
import { parseVendors } from "../parse/parse-vendors";
import { checkInsertable } from "../parse/build-checks";
import { parseFastenInfo } from "../parse/insert-and-fasten";

/** Everything needed to load and persist one insertable, independent of its group. */
export interface LoadInsertableData {
    insertableId: string;
    groupId: string;
    documentId: string;
    libraryId: LibraryId;
    versionId: string;
    elementPath: ElementPath;
    name: string;
    elementType: ElementType;
    microversionId: string;
    sortOrder: number;
    /** No stored fasten preference yet, so fasten is never parsed for a brand-new element. */
    isNew: boolean;
    /** Stored insert-and-fasten preference — gates re-parsing fasten info on reload. */
    supportsFasten: boolean;
}

interface LoadedFields {
    parameters: ParameterObj[] | null;
    vendors: Vendor[];
    thumbnailUrls: ThumbnailUrls | null;
    fastenInfo: FastenInfo | null;
}

/**
 * Loads and persists a single insertable, independent of every other element in its
 * group. Each stage is its own `step.do`, so a transient failure retries just that
 * stage (Cloudflare's built-in retry); if every retry is exhausted, `run()` rejects and
 * the final `save` step never writes the new `microversionId` — the row is left exactly
 * as stale as it was, so the next reload's `getInsertablesToReload` check picks this
 * element back up automatically. No separate retry-tracking is needed.
 */
export class LoadInsertable {
    constructor(
        private readonly deps: { env: AppBindings; sessionId: string },
        private readonly data: LoadInsertableData
    ) {}

    async run(step: WorkflowStep): Promise<void> {
        const parameters = await this.loadConfiguration(step);
        const vendors = await this.parseVendors(step, parameters);
        const thumbnailUrls = await this.loadThumbnails(step);
        const fastenInfo = await this.loadFastenInfo(step);
        await this.save(step, {
            parameters,
            vendors,
            thumbnailUrls,
            fastenInfo
        });
    }

    private api(): Promise<OnshapeApi> {
        return getOnshapeApiForSessionId(this.deps.env.KV, this.deps.sessionId);
    }

    private async loadConfiguration(
        step: WorkflowStep
    ): Promise<ParameterObj[] | null> {
        const { elementId } = this.data.elementPath;
        return step.do(`load-configuration-${elementId}`, async () => {
            const rawConfig = await getConfiguration(
                await this.api(),
                this.data.elementPath
            );
            if (rawConfig.configurationParameters.length === 0) return null;
            return parseOnshapeConfiguration(rawConfig).parameters;
        });
    }

    /**
     * A discrete step even though it's pure — keeps vendor detection visible in the
     * workflow's run log, separate from where the configuration was loaded.
     */
    private async parseVendors(
        step: WorkflowStep,
        parameters: ParameterObj[] | null
    ): Promise<Vendor[]> {
        const { elementId } = this.data.elementPath;
        return step.do(`parse-vendors-${elementId}`, () =>
            Promise.resolve(
                parseVendors(
                    this.data.name,
                    parameters ? { parameters } : undefined
                )
            )
        );
    }

    private async loadThumbnails(
        step: WorkflowStep
    ): Promise<ThumbnailUrls | null> {
        const { elementId } = this.data.elementPath;
        return uploadThumbnailsWithRetry(
            step,
            `element-thumbnail-${elementId}`,
            async () =>
                uploadThumbnails(
                    this.deps.env.THUMBNAILS,
                    await this.api(),
                    this.data.elementPath,
                    this.data.microversionId
                )
        );
    }

    private async loadFastenInfo(
        step: WorkflowStep
    ): Promise<FastenInfo | null> {
        if (this.data.isNew || !this.data.supportsFasten) return null;
        const { elementId } = this.data.elementPath;
        return step.do(`load-fasten-${elementId}`, async () =>
            parseFastenInfo(
                await this.api(),
                this.data.elementPath,
                this.data.elementType
            )
        );
    }

    private async save(
        step: WorkflowStep,
        loaded: LoadedFields
    ): Promise<void> {
        const row = toInsertableRow(this.data, loaded);
        const db = getDb(this.deps.env.DB);

        await step.do(`save-insertable-${this.data.insertableId}`, async () => {
            const insertableUpsert = db
                .insert(insertables)
                .values(row)
                .onConflictDoUpdate({
                    target: [insertables.elementId, insertables.groupId],
                    set: conflictUpdateSet(insertables, [
                        "id",
                        "elementId",
                        "groupId",
                        "documentId",
                        "libraryId",
                        "isVisible",
                        "isOpenComposite",
                        "sortOrder"
                    ])
                });

            if (loaded.parameters === null) {
                await db.batch([insertableUpsert]);
                return;
            }

            const configUpsert = db
                .insert(configurations)
                .values({ id: row.id!, parameters: loaded.parameters })
                .onConflictDoUpdate({
                    target: configurations.id,
                    set: conflictUpdateSet(configurations, ["id"])
                });
            await db.batch([insertableUpsert, configUpsert]);
        });
    }
}

/** Assembles the saved insertable row from the load-insertable data + the load results. */
export function toInsertableRow(
    data: LoadInsertableData,
    loaded: LoadedFields
): typeof insertables.$inferInsert {
    return {
        id: data.insertableId,
        documentId: data.documentId,
        versionId: data.versionId,
        elementId: data.elementPath.elementId,
        groupId: data.groupId,
        libraryId: data.libraryId,
        name: data.name,
        elementType: data.elementType,
        microversionId: data.microversionId,
        sortOrder: data.sortOrder,
        supportsFasten: data.supportsFasten,
        vendors: loaded.vendors,
        thumbnailUrls: loaded.thumbnailUrls,
        fastenInfo: loaded.fastenInfo,
        buildIssues: checkInsertable({
            vendors: loaded.vendors,
            thumbnailUrls: loaded.thumbnailUrls
        })
    };
}
