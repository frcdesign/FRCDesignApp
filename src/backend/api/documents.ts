/**
 * Admin routes for reloading and managing library documents/elements.
 */
import { Hono } from "hono";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { type Bindings } from "../app";
import { getDb, type Db } from "../db";
import { getOnshapeApi } from "../auth";
import { getAccessLevel } from "../onshape-api/endpoints/users";
import { getLatestVersion } from "../onshape-api/endpoints/versions";
import { getDocument, getContents } from "../onshape-api/endpoints/documents";
import { getFeatures } from "../onshape-api/endpoints/part-studios";
import { getAssembly } from "../onshape-api/endpoints/assemblies";
import { getConfiguration } from "../onshape-api/endpoints/configurations";
import { type ElementPath, type DocumentPath, type InstancePath } from "../onshape-api/path";
import { libraries, documents, elements, configurations, favorites } from "../../shared/schema";
import {
  Library,
  Vendor,
  getVendorName,
  ElementType,
} from "../../frontend/api-utils/client-models";
import {
  ConfigurationParameterType,
  type ConfigurationResult,
} from "../../frontend/configurations/configuration-models";
import { parseOnshapeConfiguration } from "../../frontend/configurations/parse-configuration";
import { uploadThumbnails, uploadDocumentThumbnails } from "./thumbnails";

const LATEST_DOCUMENT_SCHEMA = 1;
const LATEST_ELEMENT_SCHEMA = 1;

// ─── Access ───────────────────────────────────────────────────────────────────

async function requireEditorAccess(c: { env: Bindings }): Promise<Awaited<ReturnType<typeof getOnshapeApi>>> {
  const onshapeApi = await getOnshapeApi(c as any);
  const adminTeam = (c.env as any).ADMIN_TEAM;
  if (!adminTeam) throw new Error("ADMIN_TEAM must be configured");
  const level = await getAccessLevel(onshapeApi, adminTeam);
  if (level !== "editor" && level !== "admin")
    throw new Error("Insufficient permissions");
  return onshapeApi;
}

// ─── Vendor parsing ───────────────────────────────────────────────────────────

function parseNameVendor(name: string): Vendor | undefined {
  const words = name.toUpperCase().match(/\b(\w+)\b/g) ?? [];
  for (const word of words) {
    const vendor = Object.values(Vendor).find(
      (v) => (v as string).toUpperCase() === word,
    );
    if (vendor !== undefined) return vendor;
  }
  return undefined;
}

function parseVendors(
  name: string,
  configuration?: ConfigurationResult,
): Vendor[] {
  const nameVendor = parseNameVendor(name);
  if (nameVendor) return [nameVendor];
  if (!configuration) return [];

  const vendors = new Set<Vendor>();
  for (const param of configuration.parameters) {
    if (param.type !== ConfigurationParameterType.ENUM) continue;
    for (const option of param.options) {
      const vendor = parseNameVendor(option.name);
      if (vendor) { vendors.add(vendor); continue; }
      const byFullName = Object.values(Vendor).find(
        (v) => getVendorName(v).toUpperCase() === option.name.toUpperCase(),
      );
      if (byFullName) vendors.add(byFullName);
    }
  }
  return [...vendors];
}

// ─── Fasten info parsing ──────────────────────────────────────────────────────

interface FastenInfo {
  mateConnectorId: string;
  mateLocation: "Feature" | "Part" | "Subassembly";
  path: string[];
}

function searchFeatures(
  features: any[],
  mateLocation: FastenInfo["mateLocation"],
  path: string[] = [],
): FastenInfo | undefined {
  for (const feature of features) {
    if (feature.featureType === "mateConnector") {
      const fullPath = [...path, ...feature.featureData.occurrence];
      return { mateConnectorId: feature.id, mateLocation, path: fullPath };
    }
  }
  return undefined;
}

function parseFastenInfoFromPartStudio(featureList: any): FastenInfo {
  for (const feature of featureList.features) {
    if (feature.featureType === "mateConnector") {
      return {
        mateConnectorId: feature.featureId,
        mateLocation: "Feature",
        path: [],
      };
    }
  }
  throw new Error("Failed to find a valid Mate connector feature.");
}

function parseFastenInfoFromAssembly(assemblyInfo: any): FastenInfo {
  const rootAssembly = assemblyInfo.rootAssembly;
  const fromFeatures = searchFeatures(rootAssembly.features, "Feature");
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
        return { mateConnectorId: mateConnectors[0].featureId, path, mateLocation: "Part" };
      }
    } else if (instance.type === "Assembly") {
      const subAssembly = subAssemblies[subAssemblyCounter++];
      const found = searchFeatures(subAssembly.features, "Subassembly", path);
      if (found) return found;
    }
  }
  throw new Error("Failed to find a valid Mate connector feature or instance.");
}

async function parseFastenInfo(
  onshapeApi: any,
  elementPath: ElementPath,
  elementType: ElementType,
): Promise<FastenInfo> {
  if (elementType === ElementType.PART_STUDIO) {
    const featureList = await getFeatures(onshapeApi, elementPath);
    return parseFastenInfoFromPartStudio(featureList);
  } else {
    const assemblyInfo = await getAssembly(onshapeApi, elementPath, {
      includeMateConnectors: true,
      includeMateFeatures: true,
    });
    return parseFastenInfoFromAssembly(assemblyInfo);
  }
}

// ─── Reload context ───────────────────────────────────────────────────────────

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
  private readonly savedElements: Map<string, SavedElement> = new Map();
  private readonly savedDocuments: Map<string, SavedDocument> = new Map();

  constructor(public readonly reloadAll: boolean = false) {}

  saveElement(elementId: string, data: {
    isVisible: boolean;
    isOpenComposite: boolean;
    supportsFasten: boolean;
    microversionId: string;
    fastenInfo?: string | null;
  }): void {
    this.savedElements.set(elementId, {
      elementSchema: LATEST_ELEMENT_SCHEMA,
      isVisible: data.isVisible,
      isOpenComposite: data.isOpenComposite,
      microversionId: data.microversionId,
      fastenInfo: data.fastenInfo ? JSON.parse(data.fastenInfo) : undefined,
    });
  }

  getElement(elementId: string): SavedElement {
    return this.savedElements.get(elementId) ?? { isVisible: false, isOpenComposite: false };
  }

  shouldReloadElement(elementId: string, microversionId: string): boolean {
    if (this.reloadAll) return true;
    const saved = this.getElement(elementId);
    if (!saved.elementSchema || saved.elementSchema < LATEST_ELEMENT_SCHEMA) return true;
    return saved.microversionId !== microversionId;
  }

  saveDocument(documentId: string, data: {
    sortAlphabetically: boolean;
    instanceId: string;
  }): void {
    this.savedDocuments.set(documentId, {
      documentSchema: LATEST_DOCUMENT_SCHEMA,
      sortAlphabetically: data.sortAlphabetically,
      instanceId: data.instanceId,
    });
  }

  getDocument(documentId: string): SavedDocument {
    return this.savedDocuments.get(documentId) ?? { sortAlphabetically: true };
  }

  shouldReloadDocument(instancePath: InstancePath): boolean {
    if (this.reloadAll) return true;
    const saved = this.getDocument(instancePath.documentId);
    if (!saved.documentSchema || saved.documentSchema < LATEST_DOCUMENT_SCHEMA) return true;
    return saved.instanceId !== instancePath.instanceId;
  }
}

// ─── Element/document saving ──────────────────────────────────────────────────

const VALID_ELEMENT_TYPES = new Set<string>([
  ElementType.ASSEMBLY,
  ElementType.PART_STUDIO,
]);

function getValidElements(contents: any): any[] {
  return (contents.elements as any[]).filter((e) =>
    VALID_ELEMENT_TYPES.has(e.elementType),
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

async function saveElement(
  db: Db,
  bucket: R2Bucket,
  onshapeApi: any,
  libraryId: string,
  documentId: string,
  versionPath: InstancePath,
  onshapeElement: any,
  reloadContext: ReloadContext,
): Promise<void> {
  const elementType: ElementType = onshapeElement.elementType;
  const elementId: string = onshapeElement.id;
  const microversionId: string = onshapeElement.microversionId;
  const elementPath: ElementPath = { ...versionPath, elementId };

  const onshapeConfig = await getConfiguration(onshapeApi, elementPath);
  let configuration: ConfigurationResult | undefined;
  let configurationId: string | undefined;

  if (onshapeConfig.configurationParameters.length > 0) {
    configuration = parseOnshapeConfiguration(onshapeConfig);
    configurationId = elementId;

    await db
      .insert(configurations)
      .values({
        id: elementId,
        documentId,
        libraryId,
        parameters: JSON.stringify(configuration.parameters),
      })
      .onConflictDoUpdate({
        target: configurations.id,
        set: { parameters: JSON.stringify(configuration.parameters) },
      });
  }

  const thumbnailUrls = await uploadThumbnails(
    bucket,
    onshapeApi,
    elementPath,
    microversionId,
  );

  const preserved = reloadContext.getElement(elementId);
  let fastenInfo: FastenInfo | undefined;
  if (preserved.fastenInfo) {
    fastenInfo = await parseFastenInfo(onshapeApi, elementPath, elementType);
  }

  await db
    .insert(elements)
    .values({
      id: elementId,
      documentId,
      libraryId,
      name: onshapeElement.name,
      vendors: JSON.stringify(parseVendors(onshapeElement.name, configuration)),
      elementType,
      instanceId: versionPath.instanceId,
      microversionId,
      isVisible: preserved.isVisible,
      isOpenComposite: preserved.isOpenComposite,
      supportsFasten: fastenInfo !== undefined,
      fastenInfo: fastenInfo ? JSON.stringify(fastenInfo) : null,
      configurationId,
      thumbnailUrls: JSON.stringify(thumbnailUrls),
    })
    .onConflictDoUpdate({
      target: elements.id,
      set: {
        name: onshapeElement.name,
        vendors: JSON.stringify(parseVendors(onshapeElement.name, configuration)),
        elementType,
        instanceId: versionPath.instanceId,
        microversionId,
        fastenInfo: fastenInfo ? JSON.stringify(fastenInfo) : null,
        configurationId,
        thumbnailUrls: JSON.stringify(thumbnailUrls),
      },
    });
}

async function saveDocument(
  db: Db,
  bucket: R2Bucket,
  onshapeApi: any,
  libraryId: string,
  documentId: string,
  versionPath: InstancePath,
  versionName: string,
  versionCreatedAt: string,
  reloadContext: ReloadContext,
): Promise<number> {
  const [onshapeDocument, contents] = await Promise.all([
    getDocument(onshapeApi, versionPath),
    getContents(onshapeApi, versionPath),
  ]);

  const thumbnailUrls = await uploadDocumentThumbnails(
    bucket,
    onshapeApi,
    onshapeDocument,
    contents,
    versionPath,
  );

  const validElements = getValidElements(contents);
  const validElementIds = new Set(validElements.map((e: any) => e.id as string));

  const elementsToReload = validElements.filter((e: any) =>
    reloadContext.shouldReloadElement(e.id, e.microversionId),
  );

  await Promise.all(
    elementsToReload.map((e: any) =>
      saveElement(db, bucket, onshapeApi, libraryId, documentId, versionPath, e, reloadContext),
    ),
  );

  const orderedIds = getOrderedElementIds(contents).filter((id) =>
    validElementIds.has(id),
  );

  // Delete elements no longer in Onshape
  const toDeleteIds = [...validElementIds].filter(
    (id) => !validElementIds.has(id),
  );
  if (toDeleteIds.length > 0) {
    await db
      .delete(elements)
      .where(and(eq(elements.documentId, documentId), notInArray(elements.id, [...validElementIds])));
    await db
      .delete(configurations)
      .where(and(eq(configurations.documentId, documentId), notInArray(configurations.id, [...validElementIds])));
  }

  const preserved = reloadContext.getDocument(documentId);

  await db
    .insert(documents)
    .values({
      id: documentId,
      libraryId,
      name: onshapeDocument.name,
      instanceId: versionPath.instanceId,
      sortAlphabetically: preserved.sortAlphabetically,
      elementOrder: JSON.stringify(orderedIds),
      thumbnailUrls: JSON.stringify(thumbnailUrls),
      versionName,
      versionCreatedAt,
    })
    .onConflictDoUpdate({
      target: documents.id,
      set: {
        name: onshapeDocument.name,
        instanceId: versionPath.instanceId,
        elementOrder: JSON.stringify(orderedIds),
        thumbnailUrls: JSON.stringify(thumbnailUrls),
        versionName,
        versionCreatedAt,
      },
    });

  return elementsToReload.length;
}

async function reloadDocument(
  db: Db,
  bucket: R2Bucket,
  onshapeApi: any,
  libraryId: string,
  documentId: string,
  reloadContext: ReloadContext,
): Promise<number> {
  const versionDict = await getLatestVersion(onshapeApi, { documentId });
  const instancePath: InstancePath = {
    documentId,
    instanceId: versionDict.id,
    instanceType: "v",
  };
  const versionName: string = versionDict.name;
  const versionCreatedAt: string = new Date(versionDict.createdAt).toISOString();

  const existingDoc = await db
    .select({ instanceId: documents.instanceId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .get();

  if (existingDoc && !reloadContext.shouldReloadDocument(instancePath)) {
    return 0;
  }

  return saveDocument(db, bucket, onshapeApi, libraryId, documentId, instancePath, versionName, versionCreatedAt, reloadContext);
}

async function buildReloadContext(db: Db, libraryId: string, reloadAll: boolean): Promise<ReloadContext> {
  const context = new ReloadContext(reloadAll);

  const allDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.libraryId, libraryId))
    .all();

  for (const doc of allDocs) {
    context.saveDocument(doc.id, {
      sortAlphabetically: doc.sortAlphabetically,
      instanceId: doc.instanceId,
    });
  }

  const allElements = await db
    .select()
    .from(elements)
    .where(eq(elements.libraryId, libraryId))
    .all();

  for (const el of allElements) {
    context.saveElement(el.id, {
      isVisible: el.isVisible,
      isOpenComposite: el.isOpenComposite,
      supportsFasten: el.supportsFasten,
      microversionId: el.microversionId,
      fastenInfo: el.fastenInfo,
    });
  }

  return context;
}

async function cleanFavorites(db: Db, libraryId: string): Promise<void> {
  const visibleElementIds = await db
    .select({ id: elements.id })
    .from(elements)
    .where(and(eq(elements.libraryId, libraryId), eq(elements.isVisible, true)))
    .all()
    .then((rows) => rows.map((r) => r.id));

  if (visibleElementIds.length === 0) {
    await db.delete(favorites).where(eq(favorites.libraryId, libraryId));
  } else {
    await db
      .delete(favorites)
      .where(
        and(
          eq(favorites.libraryId, libraryId),
          notInArray(favorites.elementId, visibleElementIds),
        ),
      );
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const documentRoutes = new Hono<{ Bindings: Bindings }>();

/** POST /api/reload-documents/:library?reloadAll=true */
documentRoutes.post("/reload-documents/:library", async (c) => {
  const onshapeApi = await requireEditorAccess(c);
  const library = c.req.param("library") as Library;
  const reloadAll = c.req.query("reloadAll") === "true";

  const db = getDb(c.env.DB);
  await db
    .insert(libraries)
    .values({ id: library })
    .onConflictDoNothing();

  const reloadContext = await buildReloadContext(db, library, reloadAll);

  const lib = await db
    .select({ documentOrder: libraries.documentOrder })
    .from(libraries)
    .where(eq(libraries.id, library))
    .get();

  const documentOrder: string[] = JSON.parse(lib?.documentOrder ?? "[]");

  const results = await Promise.all(
    documentOrder.map((documentId) =>
      reloadDocument(db, c.env.THUMBNAILS, onshapeApi, library, documentId, reloadContext),
    ),
  );

  await cleanFavorites(db, library);
  return c.json({ savedElements: results.reduce((a, b) => a + b, 0) });
});

/** POST /api/set-element-visibility/:library */
documentRoutes.post("/set-element-visibility/:library", async (c) => {
  await requireEditorAccess(c);
  const library = c.req.param("library") as Library;
  const body = await c.req.json<{
    documentId: string;
    elementIds: string[];
    isVisible: boolean;
  }>();

  const db = getDb(c.env.DB);

  if (!body.isVisible) {
    await db
      .delete(favorites)
      .where(
        and(
          eq(favorites.libraryId, library),
          inArray(favorites.elementId, body.elementIds),
        ),
      );
  }

  await db
    .update(elements)
    .set({ isVisible: body.isVisible })
    .where(
      and(
        eq(elements.documentId, body.documentId),
        inArray(elements.id, body.elementIds),
      ),
    );

  return c.json({ success: true });
});

/** POST /api/sort-document-alphabetically/:library */
documentRoutes.post("/sort-document-alphabetically/:library", async (c) => {
  await requireEditorAccess(c);
  const library = c.req.param("library") as Library;
  const body = await c.req.json<{
    documentId: string;
    sortAlphabetically: boolean;
  }>();

  const db = getDb(c.env.DB);
  await db
    .update(documents)
    .set({ sortAlphabetically: body.sortAlphabetically })
    .where(and(eq(documents.id, body.documentId), eq(documents.libraryId, library)));

  return c.json({ success: true });
});

/** POST /api/document-order/:library */
documentRoutes.post("/document-order/:library", async (c) => {
  await requireEditorAccess(c);
  const library = c.req.param("library") as Library;
  const body = await c.req.json<{ documentOrder: string[] }>();

  const db = getDb(c.env.DB);
  await db
    .update(libraries)
    .set({ documentOrder: JSON.stringify(body.documentOrder) })
    .where(eq(libraries.id, library));

  return c.json({ success: true });
});

/** POST /api/document/:library — add a new document */
documentRoutes.post("/document/:library", async (c) => {
  const onshapeApi = await requireEditorAccess(c);
  const library = c.req.param("library") as Library;
  const body = await c.req.json<{
    newDocumentId: string;
    selectedDocumentId?: string;
  }>();

  const documentPath: DocumentPath = { documentId: body.newDocumentId };

  let documentName: string;
  try {
    const doc = await getDocument(onshapeApi, documentPath);
    documentName = doc.name;
  } catch {
    return c.json(
      { type: "handled", message: "Failed to find the specified document.", isError: true },
      422,
    );
  }

  let versionDict: any;
  try {
    versionDict = await getLatestVersion(onshapeApi, documentPath);
  } catch {
    return c.json(
      { type: "handled", message: "Failed to find a document version to use.", isError: true },
      422,
    );
  }

  const db = getDb(c.env.DB);

  await db.insert(libraries).values({ id: library }).onConflictDoNothing();

  const lib = await db
    .select({ documentOrder: libraries.documentOrder })
    .from(libraries)
    .where(eq(libraries.id, library))
    .get();

  const documentOrder: string[] = JSON.parse(lib?.documentOrder ?? "[]");

  if (documentOrder.includes(body.newDocumentId)) {
    return c.json(
      { type: "handled", message: "Document has already been added to library.", isError: true },
      422,
    );
  }

  if (body.selectedDocumentId) {
    const selectedIndex = documentOrder.indexOf(body.selectedDocumentId);
    if (selectedIndex === -1) {
      return c.json(
        { type: "handled", message: "Selected document not found in library.", isError: true },
        422,
      );
    }
    documentOrder.splice(selectedIndex + 1, 0, body.newDocumentId);
  } else {
    documentOrder.push(body.newDocumentId);
  }

  const instancePath: InstancePath = {
    documentId: body.newDocumentId,
    instanceId: versionDict.id,
    instanceType: "v",
  };
  const versionName: string = versionDict.name;
  const versionCreatedAt = new Date(versionDict.createdAt).toISOString();

  await saveDocument(
    db,
    c.env.THUMBNAILS,
    onshapeApi,
    library,
    body.newDocumentId,
    instancePath,
    versionName,
    versionCreatedAt,
    new ReloadContext(),
  );

  await db
    .update(libraries)
    .set({ documentOrder: JSON.stringify(documentOrder) })
    .where(eq(libraries.id, library));

  return c.json({ name: documentName });
});

/** DELETE /api/document/:library?documentId=X */
documentRoutes.delete("/document/:library", async (c) => {
  await requireEditorAccess(c);
  const library = c.req.param("library") as Library;
  const documentId = c.req.query("documentId");
  if (!documentId) return c.json({ error: "documentId required" }, 400);

  const db = getDb(c.env.DB);

  // Cascade deletes elements, configurations (FK) and we handle favorites
  await db.delete(favorites).where(
    and(
      eq(favorites.libraryId, library),
      // favorites whose element is in this document
    ),
  );
  await db.delete(documents).where(and(eq(documents.id, documentId), eq(documents.libraryId, library)));

  const lib = await db
    .select({ documentOrder: libraries.documentOrder })
    .from(libraries)
    .where(eq(libraries.id, library))
    .get();

  const documentOrder: string[] = JSON.parse(lib?.documentOrder ?? "[]");
  const newOrder = documentOrder.filter((id) => id !== documentId);

  await db
    .update(libraries)
    .set({ documentOrder: JSON.stringify(newOrder) })
    .where(eq(libraries.id, library));

  await cleanFavorites(db, library);
  return c.json({ success: true });
});
