/** Hand-written subsets. For a field's real shape, regenerate `onshape-api-reference/`; see `openapi-ts.config.ts`. */
import {
    LogicalOp,
    QuantityType,
    Unit
} from "../../features/configurations/enums";

// === configuration (GET .../configuration, GET .../configurationencodings/{cid}) ===

/** `btType` discriminator of a configuration parameter. */
export enum OnshapeParameterType {
    ENUM = "BTMConfigurationParameterEnum-105",
    QUANTITY = "BTMConfigurationParameterQuantity-1826",
    BOOLEAN = "BTMConfigurationParameterBoolean-2550",
    STRING = "BTMConfigurationParameterString-872"
}

/** `btType` discriminator of a parameter visibility condition. */
export enum OnshapeVisibilityConditionType {
    LOGICAL = "BTParameterVisibilityLogical-178",
    EQUAL = "BTParameterVisibilityOnEqual-180",
    RANGE = "BTParameterVisibilityInRange-2980",
    ALWAYS_SHOWN = "BTParameterVisibilityAlwaysShown-5487",
    /** The "no condition" sentinel; stripped during parsing. */
    NONE = "BTParameterVisibilityCondition-177"
}

/** `btType` discriminator of an enum-option visibility condition. */
export enum OnshapeOptionVisibilityConditionType {
    LIST = "BTEnumOptionVisibilityForList-1613",
    RANGE = "BTEnumOptionVisibilityForRange-4297"
}

// --- visibility conditions --------------------------------------------------------

interface OnshapeLogicalVisibility {
    btType: OnshapeVisibilityConditionType.LOGICAL;
    operation: LogicalOp;
    children: OnshapeVisibilityCondition[];
}

interface OnshapeEqualVisibility {
    btType: OnshapeVisibilityConditionType.EQUAL;
    parameterId: string;
    value: string;
}

interface OnshapeRangeVisibility {
    btType: OnshapeVisibilityConditionType.RANGE;
    parameterId: string;
    optionRange: OnshapeOptionRange;
}

interface OnshapeAlwaysShownVisibility {
    btType: OnshapeVisibilityConditionType.ALWAYS_SHOWN;
}

/** The "no condition" sentinel (also appears as a child of logical conditions). */
interface OnshapeNoVisibility {
    btType: OnshapeVisibilityConditionType.NONE;
}

export type OnshapeVisibilityCondition =
    | OnshapeLogicalVisibility
    | OnshapeEqualVisibility
    | OnshapeRangeVisibility
    | OnshapeAlwaysShownVisibility
    | OnshapeNoVisibility;

/** A `[start, end]` range over an enum parameter's ordered options. */
interface OnshapeOptionRange {
    start: string;
    end: string;
}

// --- enum option visibility conditions --------------------------------------------

interface OnshapeOptionVisibilityForList {
    btType: OnshapeOptionVisibilityConditionType.LIST;
    controlledOptions: string[];
    condition: OnshapeVisibilityCondition;
}

interface OnshapeOptionVisibilityForRange {
    btType: OnshapeOptionVisibilityConditionType.RANGE;
    controlledRange: OnshapeOptionRange;
    condition: OnshapeVisibilityCondition;
}

type OnshapeEnumOptionVisibilityCondition =
    | OnshapeOptionVisibilityForList
    | OnshapeOptionVisibilityForRange;

export interface OnshapeEnumOptionVisibilityConditionList {
    visibilityConditions: OnshapeEnumOptionVisibilityCondition[];
}

// --- configuration parameters -----------------------------------------------------

interface OnshapeEnumOption {
    option: string;
    optionName: string;
}

interface OnshapeQuantityRange {
    units: Unit;
    defaultValue: number;
    minValue: number;
    maxValue: number;
}

interface OnshapeParameterBase {
    parameterId: string;
    parameterName: string;
    visibilityCondition: OnshapeVisibilityCondition;
}

interface OnshapeEnumParameter extends OnshapeParameterBase {
    btType: OnshapeParameterType.ENUM;
    defaultValue: string;
    options: OnshapeEnumOption[];
    enumOptionVisibilityConditions?: OnshapeEnumOptionVisibilityConditionList;
}

interface OnshapeBooleanParameter extends OnshapeParameterBase {
    btType: OnshapeParameterType.BOOLEAN;
    defaultValue: boolean;
}

interface OnshapeStringParameter extends OnshapeParameterBase {
    btType: OnshapeParameterType.STRING;
    defaultValue: string;
}

interface OnshapeQuantityParameter extends OnshapeParameterBase {
    btType: OnshapeParameterType.QUANTITY;
    quantityType: QuantityType;
    rangeAndDefault: OnshapeQuantityRange;
}

type OnshapeConfigurationParameter =
    | OnshapeEnumParameter
    | OnshapeBooleanParameter
    | OnshapeStringParameter
    | OnshapeQuantityParameter;

/** GET /elements/.../configuration response. */
export interface OnshapeConfigurationResponse {
    btType: "BTConfigurationResponse-2019";
    configurationParameters: OnshapeConfigurationParameter[];
}

// === versions (GET /documents/d/{did}/versions) ===

/** An item from GET /documents/d/{did}/versions. */
export interface OnshapeVersionInfo {
    id: string;
    name: string;
    /** ISO-8601 timestamp. */
    createdAt: string;
    creator?: { id: string };
}

// === owners (BTOwnerInfo, on a document or a team) ===

/** `BTOwnerInfo.type`: who owns a resource. */
export enum OnshapeOwnerType {
    USER = 0,
    /** An enterprise, or an educator plan's classroom. */
    COMPANY = 1
}

// === documents (GET /documents/{did}, GET .../contents) ===

/** Element (tab) types in a document (the Onshape `GBTElementType` values we handle). */
export enum OnshapeElementType {
    PART_STUDIO = "PARTSTUDIO",
    ASSEMBLY = "ASSEMBLY",
    DRAWING = "DRAWING",
    FEATURE_STUDIO = "FEATURESTUDIO",
    BLOB = "BLOB"
}

/** Discriminator (`btType`) of an entry in the document contents folder tree. */
export enum OnshapeFolderEntryType {
    GROUP = "BTElementGroup-1458",
    ELEMENT = "BTDocumentElementReference-2484"
}

/** GET /documents/{did} (only the fields we read). */
export interface OnshapeDocumentInfo {
    id: string;
    name: string;
    documentThumbnailElementId?: string;
    /** Shared with every Onshape user; an enterprise's document never is. */
    public: boolean;
    /** Not confirmed to always be sent; the load throws when it's absent. */
    defaultWorkspace?: { id: string };
    /** The caller's permissions on it, as `GET /documents/{did}/permissionset` answers. */
    permissionSet?: string[];
    owner?: {
        id: string;
        type: OnshapeOwnerType;
        /** Tells an enterprise from a classroom, which are both companies. */
        isEnterpriseOwnedResource?: boolean;
    };
}

/** A workspace, as much of Onshape's `BTWorkspaceInfo` as anything reads. */
export interface OnshapeWorkspaceInfo {
    id: string;
    name: string;
    description?: string;
}

/** A folder (group) node in the document contents tree. */
export interface OnshapeElementGroup {
    btType: OnshapeFolderEntryType.GROUP;
    /** The folder's name; the root folder's is not one anybody sees. */
    groupName?: string;
    /** Child folders and element references, in display order. */
    groups: OnshapeFolderEntry[];
}

/** A reference to an element (tab) within the contents tree. */
interface OnshapeElementReference {
    btType: OnshapeFolderEntryType.ELEMENT;
    elementId: string;
}

export type OnshapeFolderEntry = OnshapeElementGroup | OnshapeElementReference;

/** An element (tab) listed in the document contents. */
export interface OnshapeElement {
    id: string;
    name: string;
    elementType: OnshapeElementType;
    microversionId: string;
}

/** GET /documents/d/{did}/{wvm}/{wvmid}/contents (the fields we read). */
export interface OnshapeDocumentContents {
    /** Root folder; its `groups` is the ordered folder/element tree. */
    folders: OnshapeElementGroup;
    /** Flat list of all elements (tabs) in the document. */
    elements: OnshapeElement[];
}

// === assemblies (GET /assemblies/.../e/{eid}, POST .../{transformedinstances,features}) ===

/** A feature in an assembly's root or a subassembly. */
export interface OnshapeAssemblyFeature {
    featureType: string;
    id: string;
    suppressed?: boolean;
    featureData?: {
        name?: string;
        /** A mate connector's: the path to the connector. */
        occurrence?: string[];
        /** A mate's two ends; an empty `matedOccurrence` is the assembly origin. */
        matedEntities?: { matedOccurrence?: string[] }[];
        /** A group's members (`featureType` "mateGroup"). */
        occurrences?: { occurrence?: string[] }[];
    };
}

/** A top-level instance in the root assembly. */
export interface OnshapeAssemblyInstance {
    id: string;
    /**
     * "Part", "Assembly", or "Feature" for an inserted sketch. Absent, with
     * everything but `id` and `name`, when what it was inserted from is gone.
     */
    type?: string;
    /** Optional only so a test fixture can leave it out. */
    name?: string;
    suppressed?: boolean;
    /** A part's; empty when the part it was inserted from is gone. */
    partId?: string;
    /** The tab the instance came from, and the feature within it for a sketch. */
    documentId?: string;
    elementId?: string;
    featureId?: string;
}

/** Where one instance sits, as a row-major 4×4 and the path that owns it. */
interface OnshapeOccurrence {
    /** Instance ids from the root down; one entry for a top-level instance. */
    path: string[];
    transform: number[];
    fixed?: boolean;
}

/** A part in the assembly's flattened `parts` list. */
interface OnshapeAssemblyPart {
    mateConnectors?: { featureId: string }[];
}

/** A subassembly in the assembly's flattened `subAssemblies` list. */
interface OnshapeSubAssembly {
    features: OnshapeAssemblyFeature[];
}

/** What `parts` is for part instances. */
interface OnshapeAssemblyPsFeature {
    documentId?: string;
    elementId?: string;
    featureId?: string;
}

/** GET /assemblies/d/{did}/{wvm}/{wvmid}/e/{eid} (the subset we read). */
export interface OnshapeAssemblyDefinition {
    rootAssembly: {
        features: OnshapeAssemblyFeature[];
        instances: OnshapeAssemblyInstance[];
        /** Optional only so a test fixture can leave out what it does not read. */
        occurrences?: OnshapeOccurrence[];
        /** The assembly's "Part number" property, when set. */
        partNumber?: string;
        /** Each pattern's copies, keyed by the instance they copy. */
        patterns?: {
            suppressed?: boolean;
            seedToPatternInstances?: Record<string, string[]>;
        }[];
    };
    parts: OnshapeAssemblyPart[];
    subAssemblies: OnshapeSubAssembly[];
    /** Absent when the assembly holds no instance of a part studio feature. */
    partStudioFeatures?: OnshapeAssemblyPsFeature[];
}

/** GET /assemblies/.../boundingboxes response, in metres. */
export interface OnshapeBoundingBox {
    lowX: number;
    lowY: number;
    lowZ: number;
    highX: number;
    highY: number;
    highZ: number;
}

/** POST /assemblies/.../transformedinstances response (the subset we read). */
export interface OnshapeInsertInstancesResponse {
    insertInstanceResponses?: {
        occurrences?: { path: string[] }[];
    }[];
}

/** POST /assemblies|partstudios/.../features response (the subset we read). */
export interface OnshapeCreatedFeature {
    feature: { featureId: string };
}

// === parts (GET /parts/d/{did}/{wvm}/{wvmid}/e/{eid}) ===

/** A part's body classification; `composite` marks an open composite's part. */
type OnshapePartBodyType = "solid" | "sheet" | "composite";

/** A part in a part studio (the subset we read). */
export interface OnshapePart {
    partId: string;
    /** The part's metadata properties; null when unset. */
    partNumber?: string | null;
    bodyType?: OnshapePartBodyType;
    name?: string;
    description?: string | null;
    /** Absent when unset. */
    material?: { displayName?: string };
    vendor?: string;
}

// === element metadata (GET /metadata/.../e/{eid}) ===

/** One property in an element's metadata bag. */
interface OnshapeMetadataProperty {
    /** Display name, e.g. "Part number" — how we pick out the ones we store. */
    name: string;
    value: unknown;
}

/** GET /metadata/.../e/{eid} (the subset we read). */
export interface OnshapeMetadataObject {
    properties: OnshapeMetadataProperty[];
}

// === part studios (GET .../partstudios/.../features) ===

/** A feature in a part studio. */
interface OnshapePartStudioFeature {
    featureType: string;
    featureId: string;
    name: string;
    /** In the configuration asked for. */
    suppressed: boolean;
    /** A configuration decides whether it is suppressed. */
    suppressionConfigured?: boolean;
    /** A custom feature's Feature Studio, `d{documentId}::v{versionId}::e{elementId}::m{microversionId}`. */
    namespace?: string;
    parameters?: OnshapeFeatureParameter[];
}

/** A feature's parameter; only a selection box's picks are read. */
interface OnshapeFeatureParameter {
    btType: string;
    parameterId: string;
    /** A query list's picks. */
    queries?: OnshapeFeatureQuery[];
}

interface OnshapeFeatureQuery {
    btType: string;
    /** With geometry ids asked for, what the pick resolves to: none once it is gone. */
    deterministicIds?: string[];
}

type OnshapeFeatureStatus = "OK" | "INFO" | "WARNING" | "ERROR" | "UNKNOWN";

/** Whether a feature regenerated. */
interface OnshapeFeatureState {
    featureStatus?: OnshapeFeatureStatus;
}

/** GET /partstudios/d/{did}/{wvm}/{wvmid}/e/{eid}/features (the subset we read). */
export interface OnshapeFeatureListResponse {
    features: OnshapePartStudioFeature[];
    /** Keyed by feature id. */
    featureStates?: Record<string, OnshapeFeatureState>;
    /** The index of the first feature below the rollback bar: the feature count at the end, or -1 by the spec. */
    rollbackIndex?: number;
}

export type OnshapeSketchSolveStatus =
    | "UNDERDEFINED"
    | "WELL_DEFINED"
    | "OVERDEFINED"
    | "UNKNOWN";

/** GET /partstudios/d/{did}/{wvm}/{wvmid}/e/{eid}/sketches (the subset we read). */
export interface OnshapeSketchList {
    /** Unsuppressed sketches above the rollback bar. */
    sketches?: {
        featureId: string;
        sketchSolveStatus?: OnshapeSketchSolveStatus;
    }[];
}

// === external references (GET /documents/d/{did}/w/{wid}/externalreferences) ===

/**
 * One external instance a tab references: the document and version it lives in,
 * and which of that instance's tabs are referenced.
 */
export interface OnshapeExternalReference {
    documentId: string;
    /** The referenced instance's id. Always a version: references are to versions. */
    id: string;
    /** Onshape's own verdict on whether a newer version exists. */
    isOutOfDate: boolean;
    referencedElements: string[];
}

/**
 * GET /documents/d/{did}/w/{wid}/externalreferences (the subset we read).
 * Undocumented (absent from the OpenAPI spec); shape unverified.
 */
export interface OnshapeExternalReferences {
    /** Keyed by the referencing tab's element id. */
    elementExternalReferences?: Record<string, OnshapeExternalReference[]>;
    /** The newest version of each referenced document. */
    latestVersions?: { documentId: string; id: string }[];
}

// === insertables (GET /documents/d/{did}/{wv}/{wvid}/insertables) ===

/** GET /documents/d/{did}/{wv}/{wvid}/insertables (the subset we read). */
/** One thing that can be inserted from an instance (the subset we read). */
interface OnshapeInsertable {
    predictableThumbnailId?: string;
}

export interface OnshapeInsertables {
    items?: OnshapeInsertable[];
    /**
     * Edits made in the workspace that its latest version does not carry.
     * Absent for a version, which is a snapshot and cannot have moved on.
     */
    changesSinceVersionSave?: number;
}
