/**
 * Admin server functions for reloading and managing the library document/element database.
 */
import { createServerFn } from "@tanstack/react-start";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
    Library,
    Vendor,
    getVendorName,
    ElementType
} from "../api-utils/client-models";
import { OAuthApi } from "../onshape-api/client/oauth-api";
import { AccessLevel, getAccessLevel } from "../onshape-api/endpoints/users";
import { getLatestVersion } from "../onshape-api/endpoints/versions";
import { getDocument, getContents } from "../onshape-api/endpoints/documents";
import { getFeatures } from "../onshape-api/endpoints/part-studios";
import { getAssembly } from "../onshape-api/endpoints/assemblies";
import { getConfiguration } from "../onshape-api/endpoints/configurations";
import { ElementPath, DocumentPath, InstancePath } from "../onshape-api/path";
import { getLibrary, LibraryRef } from "../connect/library";
import { getOnshapeApi } from "../routes/auth/-auth.server";
import {
    DocumentData,
    ElementData,
    FastenInfo,
    MateLocation,
    VersionInfo
} from "../connect/db-models";
import { uploadThumbnails, uploadDocumentThumbnails } from "../connect/storage";
import { parseOnshapeConfiguration } from "../configurations/parse-configuration";
import {
    ConfigurationParameterType,
    ConfigurationResult
} from "../configurations/configuration-models";

const LATEST_DOCUMENT_SCHEMA = 1;
const LATEST_ELEMENT_SCHEMA = 1;

async function getAppAccessLevel(onshapeApi: OAuthApi): Promise<AccessLevel> {
    const override = process.env.ACCESS_LEVEL_OVERRIDE;
    if (override) return override as AccessLevel;

    const adminTeam = process.env.ADMIN_TEAM;
    if (!adminTeam)
        throw new Error(
            "ADMIN_TEAM or ACCESS_LEVEL_OVERRIDE must be configured"
        );

    return getAccessLevel(onshapeApi, adminTeam);
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

// ─── Vendor parsing ──────────────────────────────────────────────────────────

function parseNameVendor(name: string): Vendor | undefined {
    const words = name.toUpperCase().match(/\b(\w+)\b/g) ?? [];
    for (const word of words) {
        const vendor = Object.values(Vendor).find(
            (v) => (v as string).toUpperCase() === word
        );
        if (vendor !== undefined) return vendor;
    }
    return undefined;
}

function parseVendors(
    name: string,
    configuration?: ConfigurationResult
): Vendor[] {
    const nameVendor = parseNameVendor(name);
    if (nameVendor) return [nameVendor];

    if (!configuration) return [];

    const vendors = new Set<Vendor>();
    for (const param of configuration.parameters) {
        if (param.type !== ConfigurationParameterType.ENUM) continue;
        for (const option of param.options) {
            const vendor = parseNameVendor(option.name);
            if (vendor) {
                vendors.add(vendor);
                continue;
            }
            const byFullName = Object.values(Vendor).find(
                (v) =>
                    getVendorName(v).toUpperCase() === option.name.toUpperCase()
            );
            if (byFullName) vendors.add(byFullName);
        }
    }
    return [...vendors];
}

interface SavedElement {
    elementSchema?: number;
    isVisible: boolean;
    isOpenComposite: boolean;
    fastenInfo?: FastenInfo;
    microversionId?: string;
}

interface SavedDocument {
    documentSchema?: number;
    sortAlphabetically: boolean;
    instanceId?: string;
}

class ReloadContext {
    private readonly elements: Map<string, SavedElement> = new Map();
    private readonly documents: Map<string, SavedDocument> = new Map();

    constructor(public readonly reloadAll: boolean = false) {}

    saveElement(elementId: string, data: Partial<ElementData>): void {
        this.elements.set(elementId, {
            elementSchema: data.elementSchema,
            isVisible: data.isVisible ?? false,
            isOpenComposite: data.isOpenComposite ?? false,
            fastenInfo: data.fastenInfo,
            microversionId: data.microversionId
        });
    }

    getElement(elementId: string): SavedElement {
        return (
            this.elements.get(elementId) ?? {
                isVisible: false,
                isOpenComposite: false
            }
        );
    }

    shouldReloadElement(elementId: string, microversionId: string): boolean {
        if (this.reloadAll) return true;
        const saved = this.getElement(elementId);
        if (!saved.elementSchema || saved.elementSchema < LATEST_ELEMENT_SCHEMA)
            return true;
        return saved.microversionId !== microversionId;
    }

    saveDocument(documentId: string, data: Partial<DocumentData>): void {
        this.documents.set(documentId, {
            documentSchema: data.documentSchema,
            sortAlphabetically: data.sortAlphabetically ?? true,
            instanceId: data.instanceId
        });
    }

    getDocument(documentId: string): SavedDocument {
        return this.documents.get(documentId) ?? { sortAlphabetically: true };
    }

    shouldReloadDocument(instancePath: InstancePath): boolean {
        if (this.reloadAll) return true;
        const saved = this.getDocument(instancePath.documentId);
        if (
            !saved.documentSchema ||
            saved.documentSchema < LATEST_DOCUMENT_SCHEMA
        )
            return true;
        return saved.instanceId !== instancePath.instanceId;
    }
}

function searchFeatures(
    features: any[],
    mateLocation: MateLocation,
    path: string[] = []
): FastenInfo | undefined {
    for (const feature of features) {
        if (feature.featureType === "mateConnector") {
            const fullPath = [...path, ...feature.featureData.occurrence];
            return {
                mateConnectorId: feature.id,
                mateLocation,
                path: fullPath
            };
        }
    }
    return undefined;
}

function parseFastenInfoFromPartStudio(featureList: any): FastenInfo {
    for (const feature of featureList.features) {
        if (feature.featureType === "mateConnector") {
            return {
                mateConnectorId: feature.featureId,
                mateLocation: MateLocation.FEATURE,
                path: []
            };
        }
    }
    throw new Error("Failed to find a valid Mate connector feature.");
}

function parseFastenInfoFromAssembly(assemblyInfo: any): FastenInfo {
    const rootAssembly = assemblyInfo.rootAssembly;

    const fromFeatures = searchFeatures(
        rootAssembly.features,
        MateLocation.FEATURE
    );
    if (fromFeatures) return fromFeatures;

    const parts: any[] = assemblyInfo.parts;
    const subAssemblies: any[] = assemblyInfo.subAssemblies;
    let partCounter = 0;
    let subAssemblyCounter = 0;

    for (const instance of rootAssembly.instances) {
        const path = [instance.id as string];
        if (instance.type === "Part") {
            const part = parts[partCounter++];
            const mateConnectors: any[] = part.mateConnectors ?? [];
            if (mateConnectors.length > 0) {
                return {
                    mateConnectorId: mateConnectors[0].featureId,
                    path,
                    mateLocation: MateLocation.PART
                };
            }
        } else if (instance.type === "Assembly") {
            const subAssembly = subAssemblies[subAssemblyCounter++];
            const found = searchFeatures(
                subAssembly.features,
                MateLocation.SUBASSEMBLY,
                path
            );
            if (found) return found;
        }
    }

    throw new Error(
        "Failed to find a valid Mate connector feature or instance with a Mate connector."
    );
}

async function parseFastenInfo(
    onshapeApi: OAuthApi,
    elementPath: ElementPath,
    elementType: ElementType
): Promise<FastenInfo> {
    if (elementType === ElementType.PART_STUDIO) {
        const featureList = await getFeatures(onshapeApi, elementPath);
        return parseFastenInfoFromPartStudio(featureList);
    } else {
        const assemblyInfo = await getAssembly(onshapeApi, elementPath, {
            includeMateConnectors: true,
            includeMateFeatures: true
        });
        return parseFastenInfoFromAssembly(assemblyInfo);
    }
}

// ─── Element & document saving ───────────────────────────────────────────────

const VALID_ELEMENT_TYPES = new Set<string>([
    ElementType.ASSEMBLY,
    ElementType.PART_STUDIO
]);

function getValidElements(contents: any): any[] {
    return (contents.elements as any[]).filter((e) =>
        VALID_ELEMENT_TYPES.has(e.elementType)
    );
}

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

function parseVersion(
    versionDict: any,
    documentId: string
): { instancePath: InstancePath; versionInfo: VersionInfo } {
    return {
        instancePath: {
            documentId,
            instanceId: versionDict.id,
            instanceType: "v"
        },
        versionInfo: {
            name: versionDict.name,
            createdAt: Timestamp.fromDate(new Date(versionDict.createdAt))
        }
    };
}

async function saveElement(
    onshapeApi: OAuthApi,
    libraryRef: LibraryRef,
    documentId: string,
    versionPath: InstancePath,
    onshapeElement: any,
    reloadContext: ReloadContext
): Promise<void> {
    const elementType: ElementType = onshapeElement.elementType;
    const elementId: string = onshapeElement.id;
    const microversionId: string = onshapeElement.microversionId;

    const elementPath: ElementPath = { ...versionPath, elementId };
    const docRef = libraryRef.documents.document(documentId);

    const onshapeConfig = await getConfiguration(onshapeApi, elementPath);
    let configuration: ConfigurationResult | undefined;
    let configurationId: string | undefined;

    if (onshapeConfig.configurationParameters.length > 0) {
        configuration = parseOnshapeConfiguration(onshapeConfig);
        await docRef.configurations.configuration(elementId).set(configuration);
        configurationId = elementId;
    }

    const thumbnailUrls = await uploadThumbnails(
        onshapeApi,
        elementPath,
        microversionId
    );

    const preserved = reloadContext.getElement(elementId);

    let fastenInfo: FastenInfo | undefined;
    if (preserved.fastenInfo) {
        fastenInfo = await parseFastenInfo(onshapeApi, elementPath, elementType);
    }

    await docRef.elements.element(elementId).set({
        elementSchema: LATEST_ELEMENT_SCHEMA,
        name: onshapeElement.name,
        vendors: parseVendors(onshapeElement.name, configuration),
        elementType,
        documentId,
        instanceId: versionPath.instanceId,
        microversionId,
        isVisible: preserved.isVisible,
        isOpenComposite: preserved.isOpenComposite,
        fastenInfo,
        configurationId,
        thumbnailUrls
    } satisfies ElementData);
}

async function saveDocument(
    onshapeApi: OAuthApi,
    libraryRef: LibraryRef,
    documentId: string,
    versionPath: InstancePath,
    versionInfo: VersionInfo,
    reloadContext: ReloadContext
): Promise<number> {
    const documentRef = libraryRef.documents.document(documentId);

    const [onshapeDocument, contents] = await Promise.all([
        getDocument(onshapeApi, versionPath),
        getContents(onshapeApi, versionPath)
    ]);

    const thumbnailUrls = await uploadDocumentThumbnails(
        onshapeApi,
        onshapeDocument,
        contents,
        versionPath
    );

    const validElements = getValidElements(contents);
    const validElementIds = new Set(
        validElements.map((e: any) => e.id as string)
    );

    const elementsToReload = validElements.filter((e: any) =>
        reloadContext.shouldReloadElement(e.id, e.microversionId)
    );

    await Promise.all(
        elementsToReload.map((e: any) =>
            saveElement(
                onshapeApi,
                libraryRef,
                documentId,
                versionPath,
                e,
                reloadContext
            )
        )
    );

    const orderedIds = getOrderedElementIds(contents).filter((id) =>
        validElementIds.has(id)
    );

    const existingIds = await documentRef.elements.keys();
    const toDelete = existingIds.filter((id) => !validElementIds.has(id));
    await Promise.all(
        toDelete.map(async (id) => {
            await documentRef.elements.element(id).delete();
            await documentRef.configurations.configuration(id).delete();
        })
    );

    const preserved = reloadContext.getDocument(documentId);
    await documentRef.set({
        documentSchema: LATEST_DOCUMENT_SCHEMA,
        name: onshapeDocument.name,
        thumbnailUrls,
        instanceId: versionPath.instanceId,
        elementOrder: orderedIds,
        sortAlphabetically: preserved.sortAlphabetically,
        versionInfo
    } satisfies DocumentData);

    return elementsToReload.length;
}

async function reloadDocument(
    onshapeApi: OAuthApi,
    libraryRef: LibraryRef,
    documentId: string,
    reloadContext: ReloadContext
): Promise<number> {
    const versionDict = await getLatestVersion(onshapeApi, { documentId });
    const { instancePath, versionInfo } = parseVersion(versionDict, documentId);

    const documentRef = libraryRef.documents.document(documentId);
    const existing = await documentRef.get();

    if (existing && !reloadContext.shouldReloadDocument(instancePath)) {
        return 0;
    }

    return saveDocument(
        onshapeApi,
        libraryRef,
        documentId,
        instancePath,
        versionInfo,
        reloadContext
    );
}

async function buildReloadContext(
    libraryRef: LibraryRef,
    reloadAll: boolean
): Promise<ReloadContext> {
    const context = new ReloadContext(reloadAll);
    const documentIds = await libraryRef.documents.keys();

    await Promise.all(
        documentIds.map(async (documentId) => {
            const docRef = libraryRef.documents.document(documentId);
            const docData = await docRef.get();
            if (docData) context.saveDocument(documentId, docData);

            const elementEntries = await docRef.elements.list();
            for (const { id, data } of elementEntries) {
                context.saveElement(id, data);
            }
        })
    );

    return context;
}

async function cleanFavorites(libraryRef: LibraryRef): Promise<void> {
    const elements = new Map<string, ElementData>();
    const documentIds = await libraryRef.documents.keys();

    await Promise.all(
        documentIds.map(async (documentId) => {
            const docRef = libraryRef.documents.document(documentId);
            const elementEntries = await docRef.elements.list();
            for (const { id, data } of elementEntries) {
                elements.set(id, data);
            }
        })
    );

    const userDataEntries = await libraryRef.userData.list();
    await Promise.all(
        userDataEntries.map(async ({ id: userId }) => {
            const userRef = libraryRef.userData.userDataFor(userId);
            const favorites = await userRef.favorites.list();
            await Promise.all(
                favorites.map(async ({ id: favoriteId }) => {
                    const element = elements.get(favoriteId);
                    if (!element || !element.isVisible) {
                        await userRef.favorites.remove(favoriteId);
                    }
                })
            );
        })
    );
}

// ─── Server functions ────────────────────────────────────────────────────────

/**
 * Reloads the contents of all documents in the library from Onshape.
 * Requires MEMBER-level access.
 */
export const reloadDocuments = createServerFn()
    .inputValidator((data: { library: Library; reloadAll?: boolean }) => data)
    .handler(async ({ data: { library, reloadAll = false } }) => {
        const onshapeApi = await getOnshapeApi();
        await requireAccess(onshapeApi);

        const libraryRef = getLibrary(library);
        const reloadContext = await buildReloadContext(libraryRef, reloadAll);
        const documentIds = await libraryRef.documents.keys();

        const results = await Promise.all(
            documentIds.map((documentId) =>
                reloadDocument(onshapeApi, libraryRef, documentId, reloadContext)
            )
        );

        await cleanFavorites(libraryRef);

        return { savedElements: results.reduce((a, b) => a + b, 0) };
    });

/**
 * Sets the visibility of one or more elements in a document.
 * Requires MEMBER-level access.
 */
export const setElementVisibility = createServerFn()
    .inputValidator(
        (data: {
            library: Library;
            documentId: string;
            elementIds: string[];
            isVisible: boolean;
        }) => data
    )
    .handler(
        async ({ data: { library, documentId, elementIds, isVisible } }) => {
            const onshapeApi = await getOnshapeApi();
            await requireAccess(onshapeApi);

            const libraryRef = getLibrary(library);
            const documentRef = libraryRef.documents.document(documentId);

            if (!isVisible) {
                const userDataEntries = await libraryRef.userData.list();
                await Promise.all(
                    userDataEntries.map(async ({ id: userId }) => {
                        const userRef = libraryRef.userData.userDataFor(userId);
                        const favorites = await userRef.favorites.list();
                        await Promise.all(
                            favorites
                                .filter(({ id }) => elementIds.includes(id))
                                .map(({ id }) => userRef.favorites.remove(id))
                        );
                    })
                );
            }

            await Promise.all(
                elementIds.map((elementId) =>
                    documentRef.elements
                        .element(elementId)
                        .update({ isVisible })
                )
            );

            return { success: true };
        }
    );

/**
 * Sets whether a document should be sorted alphabetically.
 * Requires MEMBER-level access.
 */
export const setSortAlphabetically = createServerFn()
    .inputValidator(
        (data: {
            library: Library;
            documentId: string;
            sortAlphabetically: boolean;
        }) => data
    )
    .handler(async ({ data: { library, documentId, sortAlphabetically } }) => {
        const onshapeApi = await getOnshapeApi();
        await requireAccess(onshapeApi);

        await getLibrary(library)
            .documents.document(documentId)
            .update({ sortAlphabetically });
        return { success: true };
    });

/**
 * Sets the order of documents in the library.
 * Requires MEMBER-level access.
 */
export const setDocumentOrder = createServerFn()
    .inputValidator(
        (data: { library: Library; documentOrder: string[] }) => data
    )
    .handler(async ({ data: { library, documentOrder } }) => {
        const onshapeApi = await getOnshapeApi();
        await requireAccess(onshapeApi);

        await getLibrary(library).ref.update({ documentOrder });
        return { success: true };
    });

/**
 * Adds a new document to the library and loads its latest version.
 * Requires MEMBER-level access.
 */
export const addDocument = createServerFn()
    .inputValidator(
        (data: {
            library: Library;
            documentId: string;
            selectedDocumentId?: string;
        }) => data
    )
    .handler(
        async ({
            data: { library, documentId: newDocumentId, selectedDocumentId }
        }) => {
            const onshapeApi = await getOnshapeApi();
            await requireAccess(onshapeApi);

            const documentPath: DocumentPath = { documentId: newDocumentId };

            let documentName: string;
            try {
                const doc = await getDocument(onshapeApi, documentPath);
                documentName = doc.name;
            } catch {
                throw new Error("Failed to find the specified document.");
            }

            let versionDict: any;
            try {
                versionDict = await getLatestVersion(onshapeApi, documentPath);
            } catch {
                throw new Error("Failed to find a document version to use.");
            }

            const libraryRef = getLibrary(library);
            const documentOrder = await libraryRef.documents.keys();

            if (documentOrder.includes(newDocumentId)) {
                throw new Error("Document has already been added to library.");
            }

            if (selectedDocumentId) {
                const selectedIndex = documentOrder.indexOf(selectedDocumentId);
                if (selectedIndex === -1)
                    throw new Error("Selected document not found in library.");
                documentOrder.splice(selectedIndex + 1, 0, newDocumentId);
            } else {
                documentOrder.push(newDocumentId);
            }

            const { instancePath, versionInfo } = parseVersion(
                versionDict,
                newDocumentId
            );
            await saveDocument(
                onshapeApi,
                libraryRef,
                newDocumentId,
                instancePath,
                versionInfo,
                new ReloadContext()
            );

            // Update order after successfully saving the document
            await libraryRef.ref.update({ documentOrder });
            return { name: documentName };
        }
    );

/**
 * Removes a document and all its elements from the library.
 * Requires MEMBER-level access.
 */
export const deleteDocument = createServerFn()
    .inputValidator((data: { library: Library; documentId: string }) => data)
    .handler(async ({ data: { library, documentId } }) => {
        const onshapeApi = await getOnshapeApi();
        await requireAccess(onshapeApi);

        const libraryRef = getLibrary(library);
        const documentRef = libraryRef.documents.document(documentId);

        const [elementEntries, configEntries] = await Promise.all([
            documentRef.elements.list(),
            documentRef.configurations.list()
        ]);

        await Promise.all([
            ...elementEntries.map(({ id }) =>
                documentRef.elements.element(id).delete()
            ),
            ...configEntries.map(({ id }) =>
                documentRef.configurations.configuration(id).delete()
            )
        ]);

        await documentRef.delete();
        await libraryRef.ref.update({
            documentOrder: FieldValue.arrayRemove(documentId)
        });

        await cleanFavorites(libraryRef);
        return { success: true };
    });
