import { WorkflowEntrypoint, WorkflowEvent } from "cloudflare:workers";
import type { WorkflowStep } from "cloudflare:workers";
import { and, eq, getTableColumns, notInArray, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { AppBindings } from "../app";
import { getOnshapeApiForSessionId } from "../auth";
import { getDb } from "../db";
import {
    documents,
    insertables,
    configurations,
    libraries
} from "../../shared/schema";
import { getLatestVersion } from "../onshape-api/endpoints/versions";
import { getDocument, getContents } from "../onshape-api/endpoints/documents";
import { getConfiguration } from "../onshape-api/endpoints/configurations";
import { parseFastenInfo } from "./insert-and-fasten";
import type { ElementPath, InstancePath } from "../../shared/path";
import type { ConfigurationResult } from "../../shared/configuration-models";
import {
    type FastenInfo,
    ElementType,
    type ThumbnailUrls,
    type Vendor
} from "../../shared/types";
import {
    uploadThumbnails,
    uploadDocumentThumbnails
} from "../routes/thumbnails";
import { parseOnshapeConfiguration } from "./parse-configuration";
import { parseVendors } from "./parse-vendors";

export interface LoadDocumentParams {
    documentId: string;
    libraryId: string;
    selectedDocumentId?: string;
    sessionId: string;
    forceReload?: boolean;
}

const VALID_ELEMENT_TYPES = new Set<string>([
    ElementType.ASSEMBLY,
    ElementType.PART_STUDIO
]);

const ENTRY_TYPE_GROUP = "BTElementGroup-1458";
const ENTRY_TYPE_ELEMENT = "BTDocumentElementReference-2484";

function* traverseEntry(entry: any): Generator<string> {
    if (entry.btType === ENTRY_TYPE_GROUP) {
        for (const child of entry.groups) yield* traverseEntry(child);
    } else if (entry.btType === ENTRY_TYPE_ELEMENT) {
        yield entry.elementId;
    }
}

function getOrderedElementIds(contents: any): string[] {
    const ids: string[] = [];
    for (const entry of contents.folders.groups) {
        ids.push(...traverseEntry(entry));
    }
    return ids;
}

interface ValidElement {
    elementId: string;
    name: string;
    elementType: ElementType;
    microversionId: string;
}

function getValidElements(contents: any): ValidElement[] {
    return (contents.elements as any[])
        .filter((e) => VALID_ELEMENT_TYPES.has(e.elementType))
        .map((e) => ({
            elementId: e.id as string,
            name: e.name as string,
            elementType: e.elementType as ElementType,
            microversionId: e.microversionId as string
        }));
}

/**
 * When writing a new row to a table that conflicts with an existing row,
 * use this helper to overwrite all values in the existing row except the rows in `except`.
 */
function conflictUpdateSet(
    table: SQLiteTable,
    except: string[]
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(getTableColumns(table))
            .filter(([key]) => !except.includes(key))
            .map(([key, col]) => [
                key,
                sql`excluded.${sql.identifier(col.name)}`
            ])
    );
}

interface ElementLoadResult {
    elementId: string;
    fastenInfo: FastenInfo | null;
    supportsFasten: boolean;
    vendors: Vendor[];
    configuration: ConfigurationResult | null;
    thumbnailUrls: ThumbnailUrls | null;
}

export class LoadDocumentWorkflow extends WorkflowEntrypoint<
    AppBindings,
    LoadDocumentParams
> {
    async run(
        event: WorkflowEvent<LoadDocumentParams>,
        step: WorkflowStep
    ): Promise<void> {
        const {
            documentId,
            libraryId,
            sessionId,
            selectedDocumentId,
            forceReload = false
        } = event.payload;

        // Step 1: Fetch the latest version from Onshape
        const versionInfo = await step.do("fetch-version", async () => {
            const onshapeApi = await getOnshapeApiForSessionId(
                this.env.KV,
                sessionId
            );
            const rawVersion = await getLatestVersion(onshapeApi, {
                documentId
            });
            return {
                instanceId: rawVersion.id as string,
                versionName: rawVersion.name as string,
                versionCreatedAt: new Date(rawVersion.createdAt).toISOString()
            };
        });

        // Step 2: Check if reload is needed
        const needsReload = await step.do("check-needs-reload", async () => {
            if (forceReload) return true;
            const db = getDb(this.env.DB);
            const existing = await db
                .select({ instanceId: documents.instanceId })
                .from(documents)
                .where(eq(documents.id, documentId))
                .get();
            return !existing || existing.instanceId !== versionInfo.instanceId;
        });

        if (!needsReload) return;

        // Step 3: Fetch document contents
        const contentsInfo = await step.do("fetch-contents", async () => {
            const onshapeApi = await getOnshapeApiForSessionId(
                this.env.KV,
                sessionId
            );
            const instancePath: InstancePath = {
                documentId,
                instanceId: versionInfo.instanceId,
                instanceType: "v"
            };
            const [rawDoc, rawContents] = await Promise.all([
                getDocument(onshapeApi, instancePath),
                getContents(onshapeApi, instancePath)
            ]);

            const validElements = getValidElements(rawContents);
            const validElementIds = new Set(
                validElements.map((e) => e.elementId)
            );
            const orderedElementIds = getOrderedElementIds(rawContents).filter(
                (id) => validElementIds.has(id)
            );

            return {
                docName: rawDoc.name as string,
                thumbnailElementId: rawDoc.documentThumbnailElementId as
                    | string
                    | undefined,
                validElements,
                orderedElementIds
            };
        });

        const instancePath: InstancePath = {
            documentId,
            instanceId: versionInfo.instanceId,
            instanceType: "v"
        };

        // Step 4: Check existing insertables for skip/fastenInfo decisions
        const existingInsertables = await step.do(
            "check-existing-insertables",
            async () => {
                const db = getDb(this.env.DB);
                return await db
                    .select({
                        id: insertables.id,
                        elementId: insertables.elementId,
                        microversionId: insertables.microversionId,
                        hasFastenInfo: sql<number>`(${insertables.fastenInfo} IS NOT NULL)`
                    })
                    .from(insertables)
                    .where(eq(insertables.documentId, documentId))
                    .all();
            }
        );

        const existingByElementId = new Map(
            existingInsertables.map((e) => [
                e.elementId,
                {
                    id: e.id,
                    microversionId: e.microversionId,
                    hasFastenInfo: !!e.hasFastenInfo
                }
            ])
        );

        // Step 5: Upload document-level thumbnails (with retry)
        const docThumbnailUrls = await this.uploadThumbnailsWithRetry(
            step,
            `doc-thumbnail-${documentId}`,
            async () => {
                const onshapeApi = await getOnshapeApiForSessionId(
                    this.env.KV,
                    sessionId
                );
                return (await uploadDocumentThumbnails(
                    this.env.THUMBNAILS,
                    onshapeApi,
                    instancePath
                )) as ThumbnailUrls;
            }
        );

        // Step 6: Load elements that need reloading
        const elementsToReload = forceReload
            ? contentsInfo.validElements
            : contentsInfo.validElements.filter((e) => {
                  const existing = existingByElementId.get(e.elementId);
                  return (
                      !existing || existing.microversionId !== e.microversionId
                  );
              });

        const elementResults = await Promise.all(
            elementsToReload.map((element) =>
                this.loadElement(
                    step,
                    sessionId,
                    instancePath,
                    element,
                    existingByElementId.get(element.elementId)?.hasFastenInfo ??
                        false
                )
            )
        );

        // Step 7: Save everything to DB
        await step.do("save-to-db", async () => {
            const db = getDb(this.env.DB);

            // Add to document order if this is a new document
            await db
                .insert(libraries)
                .values({ id: libraryId })
                .onConflictDoNothing();
            const lib = await db
                .select({ documentOrder: libraries.documentOrder })
                .from(libraries)
                .where(eq(libraries.id, libraryId))
                .get();
            const currentOrder: string[] = lib?.documentOrder ?? [];
            if (!currentOrder.includes(documentId)) {
                const newOrder = [...currentOrder];
                const insertAfter = selectedDocumentId
                    ? newOrder.indexOf(selectedDocumentId)
                    : -1;
                newOrder.splice(
                    insertAfter !== -1 ? insertAfter + 1 : newOrder.length,
                    0,
                    documentId
                );
                await db
                    .update(libraries)
                    .set({ documentOrder: newOrder })
                    .where(eq(libraries.id, libraryId));
            }
            const validElementIds = contentsInfo.validElements.map(
                (e) => e.elementId
            );

            // Build a per-elementId lookup for validElements to avoid repeated .find()
            const validElementMap = new Map(
                contentsInfo.validElements.map((e) => [e.elementId, e])
            );

            const configUpserts = elementResults
                .filter((r) => r.configuration !== null)
                .map((r) =>
                    db
                        .insert(configurations)
                        .values({
                            elementId: r.elementId,
                            documentId,
                            libraryId,
                            parameters: r.configuration!.parameters
                        })
                        .onConflictDoUpdate({
                            target: [
                                configurations.elementId,
                                configurations.documentId
                            ],
                            set: conflictUpdateSet(configurations, [
                                "id",
                                "elementId",
                                "documentId",
                                "libraryId"
                            ])
                        })
                );

            const insertableUpserts = elementResults.map((r) => {
                const ve = validElementMap.get(r.elementId)!;
                return db
                    .insert(insertables)
                    .values({
                        elementId: r.elementId,
                        documentId,
                        libraryId,
                        name: ve.name,
                        elementType: ve.elementType,
                        microversionId: ve.microversionId,
                        versionName: versionInfo.versionName,
                        versionCreatedAt: versionInfo.versionCreatedAt,
                        vendors: r.vendors,
                        thumbnailUrls: r.thumbnailUrls,
                        fastenInfo: r.fastenInfo,
                        supportsFasten: r.supportsFasten
                    })
                    .onConflictDoUpdate({
                        target: [insertables.elementId, insertables.documentId],
                        set: conflictUpdateSet(insertables, [
                            "id",
                            "elementId",
                            "documentId",
                            "libraryId",
                            "isVisible",
                            "isOpenComposite"
                        ])
                    });
            });

            const documentUpsert = db
                .insert(documents)
                .values({
                    id: documentId,
                    libraryId,
                    name: contentsInfo.docName,
                    instanceId: versionInfo.instanceId,
                    insertableOrder: contentsInfo.orderedElementIds,
                    thumbnailUrls: docThumbnailUrls
                })
                .onConflictDoUpdate({
                    target: documents.id,
                    set: conflictUpdateSet(documents, [
                        "id",
                        "libraryId",
                        "sortAlphabetically"
                    ])
                });

            const deleteStaleInsertables =
                validElementIds.length > 0
                    ? db
                          .delete(insertables)
                          .where(
                              and(
                                  eq(insertables.documentId, documentId),
                                  notInArray(
                                      insertables.elementId,
                                      validElementIds
                                  )
                              )
                          )
                    : db
                          .delete(insertables)
                          .where(eq(insertables.documentId, documentId));

            const deleteStaleConfigurations =
                validElementIds.length > 0
                    ? db
                          .delete(configurations)
                          .where(
                              and(
                                  eq(configurations.documentId, documentId),
                                  notInArray(
                                      configurations.elementId,
                                      validElementIds
                                  )
                              )
                          )
                    : db
                          .delete(configurations)
                          .where(eq(configurations.documentId, documentId));

            await db.batch([
                documentUpsert,
                ...configUpserts,
                ...insertableUpserts,
                deleteStaleInsertables,
                deleteStaleConfigurations
            ]);
        });
    }

    private async loadElement(
        step: WorkflowStep,
        sessionId: string,
        instancePath: InstancePath,
        element: ValidElement,
        hasFastenInfo: boolean
    ): Promise<ElementLoadResult> {
        const elementPath: ElementPath = {
            ...instancePath,
            elementId: element.elementId
        };

        // Load basic element data + fasten info
        const elementData = await step.do(
            `load-element-${element.elementId}`,
            async () => {
                const onshapeApi = await getOnshapeApiForSessionId(
                    this.env.KV,
                    sessionId
                );

                let fastenInfo: FastenInfo | null = null;
                let supportsFasten = false;

                if (hasFastenInfo) {
                    try {
                        fastenInfo = await parseFastenInfo(
                            onshapeApi,
                            elementPath,
                            element.elementType
                        );
                        supportsFasten = true;
                    } catch {
                        // Mate connector no longer present
                        fastenInfo = null;
                        supportsFasten = false;
                    }
                }

                return {
                    fastenInfo: fastenInfo
                        ? (JSON.stringify(fastenInfo) as string)
                        : null,
                    supportsFasten
                };
            }
        );

        // Load configuration (separate step for future extensibility)
        const configData = await step.do(
            `load-configuration-${element.elementId}`,
            async () => {
                const onshapeApi = await getOnshapeApiForSessionId(
                    this.env.KV,
                    sessionId
                );
                const rawConfig = await getConfiguration(
                    onshapeApi,
                    elementPath
                );
                if (rawConfig.configurationParameters.length === 0) {
                    return null;
                }
                const configuration = parseOnshapeConfiguration(rawConfig);
                return {
                    parameters: JSON.stringify(configuration.parameters),
                    vendors: JSON.stringify(
                        parseVendors(element.name, configuration)
                    )
                };
            }
        );

        // Upload element thumbnails with retry
        const thumbnailUrls = await this.uploadThumbnailsWithRetry(
            step,
            `element-thumbnail-${element.elementId}`,
            async () => {
                const onshapeApi = await getOnshapeApiForSessionId(
                    this.env.KV,
                    sessionId
                );
                const urls = await uploadThumbnails(
                    this.env.THUMBNAILS,
                    onshapeApi,
                    elementPath,
                    element.microversionId
                );
                return urls as ThumbnailUrls;
            }
        );

        const configuration = configData
            ? (JSON.parse(configData.parameters) as ConfigurationResult)
            : null;
        const vendors = configData
            ? (JSON.parse(configData.vendors) as Vendor[])
            : parseVendors(element.name);

        return {
            elementId: element.elementId,
            fastenInfo: elementData.fastenInfo
                ? (JSON.parse(elementData.fastenInfo) as FastenInfo)
                : null,
            supportsFasten: elementData.supportsFasten,
            vendors,
            configuration,
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
