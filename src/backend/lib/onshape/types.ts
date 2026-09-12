/**
 * Hand-authored subsets of the Onshape responses we use. To find a field's real
 * shape, regenerate `onshape-api-reference/` — see `openapi-ts.config.ts`.
 */
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
    isCosmetic: boolean;
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
    /**
     * Optional because nothing here has confirmed Onshape always sends it; the
     * load throws rather than guessing when it is absent.
     */
    defaultWorkspace?: { id: string };
}

/** A folder (group) node in the document contents tree. */
export interface OnshapeElementGroup {
    btType: OnshapeFolderEntryType.GROUP;
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
    /** Present on mate connectors; its `occurrence` is the path to the connector. */
    featureData?: { occurrence: string[] };
}

/** A top-level instance (part or subassembly) in the root assembly. */
interface OnshapeAssemblyInstance {
    id: string;
    /** "Part" or "Assembly". */
    type: string;
}

/** A part in the assembly's flattened `parts` list. */
interface OnshapeAssemblyPart {
    mateConnectors?: { featureId: string }[];
}

/** A subassembly in the assembly's flattened `subAssemblies` list. */
interface OnshapeSubAssembly {
    features: OnshapeAssemblyFeature[];
}

/** GET /assemblies/d/{did}/{wvm}/{wvmid}/e/{eid} (the subset we read). */
export interface OnshapeAssemblyDefinition {
    rootAssembly: {
        features: OnshapeAssemblyFeature[];
        instances: OnshapeAssemblyInstance[];
        /** The assembly's "Part number" property, when set. */
        partNumber?: string;
    };
    parts: OnshapeAssemblyPart[];
    subAssemblies: OnshapeSubAssembly[];
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
    /** The part's metadata properties, when set. */
    partNumber?: string;
    bodyType?: OnshapePartBodyType;
    name?: string;
    description?: string;
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
    suppressed: boolean;
}

/** GET /partstudios/d/{did}/{wvm}/{wvmid}/e/{eid}/features (the subset we read). */
export interface OnshapeFeatureListResponse {
    features: OnshapePartStudioFeature[];
}
