/**
 * Hand-authored types for the Onshape API endpoints we use.
 *
 * These are the types we actually import — maintained by hand (using our own enums and
 * comments) against the generated reference at the repo root in `onshape-api-reference/`
 * (run `npm run gen:onshape-types` to refresh it, then fold any upstream drift in here).
 * NOTHING imports the generated reference — it's committed (for review/diffing) but
 * lives outside `src/`, so it's outside every tsconfig's scope and never surfaces in
 * editor autocomplete/auto-import.
 */
import {
    ConfigurationParameterType,
    LogicalOp,
    OptionVisibilityConditionType,
    QuantityType,
    Unit,
    VisibilityConditionType
} from "../../shared/configuration-models";

// === configuration (GET .../configuration, GET .../configurationencodings/{cid}) ===

/** btType Onshape attaches to an always-visible (unconditional) parameter/option. */
export const VISIBILITY_CONDITION_NONE = "BTParameterVisibilityCondition-177";

// --- visibility conditions --------------------------------------------------------

export interface OnshapeLogicalVisibility {
    btType: VisibilityConditionType.LOGICAL;
    operation: LogicalOp;
    children: OnshapeVisibilityCondition[];
}

export interface OnshapeEqualVisibility {
    btType: VisibilityConditionType.EQUAL;
    parameterId: string;
    value: string;
}

export interface OnshapeRangeVisibility {
    btType: VisibilityConditionType.RANGE;
    parameterId: string;
    optionRange: OnshapeOptionRange;
}

export interface OnshapeAlwaysShownVisibility {
    btType: VisibilityConditionType.ALWAYS_SHOWN;
}

/** The "no condition" sentinel (also appears as a child of logical conditions). */
export interface OnshapeNoVisibility {
    btType: typeof VISIBILITY_CONDITION_NONE;
}

export type OnshapeVisibilityCondition =
    | OnshapeLogicalVisibility
    | OnshapeEqualVisibility
    | OnshapeRangeVisibility
    | OnshapeAlwaysShownVisibility
    | OnshapeNoVisibility;

/** A `[start, end]` range over an enum parameter's ordered options. */
export interface OnshapeOptionRange {
    start: string;
    end: string;
}

// --- enum option visibility conditions --------------------------------------------

export interface OnshapeOptionVisibilityForList {
    btType: OptionVisibilityConditionType.LIST;
    controlledOptions: string[];
    condition: OnshapeVisibilityCondition;
}

export interface OnshapeOptionVisibilityForRange {
    btType: OptionVisibilityConditionType.RANGE;
    controlledRange: OnshapeOptionRange;
    condition: OnshapeVisibilityCondition;
}

export type OnshapeEnumOptionVisibilityCondition =
    | OnshapeOptionVisibilityForList
    | OnshapeOptionVisibilityForRange;

export interface OnshapeEnumOptionVisibilityConditionList {
    visibilityConditions: OnshapeEnumOptionVisibilityCondition[];
}

// --- configuration parameters -----------------------------------------------------

export interface OnshapeEnumOption {
    option: string;
    optionName: string;
}

export interface OnshapeQuantityRange {
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

export interface OnshapeEnumParameter extends OnshapeParameterBase {
    btType: ConfigurationParameterType.ENUM;
    defaultValue: string;
    options: OnshapeEnumOption[];
    enumOptionVisibilityConditions?: OnshapeEnumOptionVisibilityConditionList;
}

export interface OnshapeBooleanParameter extends OnshapeParameterBase {
    btType: ConfigurationParameterType.BOOLEAN;
    defaultValue: boolean;
}

export interface OnshapeStringParameter extends OnshapeParameterBase {
    btType: ConfigurationParameterType.STRING;
    defaultValue: string;
}

export interface OnshapeQuantityParameter extends OnshapeParameterBase {
    btType: ConfigurationParameterType.QUANTITY;
    quantityType: QuantityType;
    rangeAndDefault: OnshapeQuantityRange;
}

export type OnshapeConfigurationParameter =
    | OnshapeEnumParameter
    | OnshapeBooleanParameter
    | OnshapeStringParameter
    | OnshapeQuantityParameter;

/** GET /elements/.../configuration response. */
export interface OnshapeConfigurationResponse {
    btType: "BTConfigurationResponse-2019";
    configurationParameters: OnshapeConfigurationParameter[];
}

// --- configuration encodings ------------------------------------------------------

export interface OnshapeConfigurationInfoEntry {
    parameterId: string;
    parameterValue: string;
}

/** GET /elements/.../configurationencodings/{cid} response. */
export interface OnshapeConfigurationInfo {
    parameters: OnshapeConfigurationInfoEntry[];
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
    name: string;
    documentThumbnailElementId?: string;
}

/** A folder (group) node in the document contents tree. */
export interface OnshapeElementGroup {
    btType: OnshapeFolderEntryType.GROUP;
    /** Child folders and element references, in display order. */
    groups: OnshapeFolderEntry[];
}

/** A reference to an element (tab) within the contents tree. */
export interface OnshapeElementReference {
    btType: OnshapeFolderEntryType.ELEMENT;
    elementId: string;
}

export type OnshapeFolderEntry = OnshapeElementGroup | OnshapeElementReference;

/** An element (tab) listed in the document contents. */
export interface OnshapeDocumentElement {
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
    elements: OnshapeDocumentElement[];
}

// === assemblies (GET /assemblies/.../e/{eid}, POST .../{transformedinstances,features}) ===
// The assembly definition is a large, deeply polymorphic feature tree; we consume just a
// few fields, so these are hand-written rather than generated.

/** A feature in an assembly's root or a subassembly. */
export interface OnshapeAssemblyFeature {
    featureType: string;
    id: string;
    /** Present on mate connectors; its `occurrence` is the path to the connector. */
    featureData?: { occurrence: string[] };
}

/** A top-level instance (part or subassembly) in the root assembly. */
export interface OnshapeAssemblyInstance {
    id: string;
    /** "Part" or "Assembly". */
    type: string;
}

/** A part in the assembly's flattened `parts` list. */
export interface OnshapeAssemblyPart {
    mateConnectors?: { featureId: string }[];
}

/** A subassembly in the assembly's flattened `subAssemblies` list. */
export interface OnshapeSubAssembly {
    features: OnshapeAssemblyFeature[];
}

/** GET /assemblies/d/{did}/{wvm}/{wvmid}/e/{eid} (the subset we read). */
export interface OnshapeAssemblyDefinition {
    rootAssembly: {
        features: OnshapeAssemblyFeature[];
        instances: OnshapeAssemblyInstance[];
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

// === part studios (GET .../partstudios/.../features) ===

/** A feature in a part studio. */
export interface OnshapePartStudioFeature {
    featureType: string;
    featureId: string;
    name: string;
    suppressed: boolean;
}

/** GET /partstudios/d/{did}/{wvm}/{wvmid}/e/{eid}/features (the subset we read). */
export interface OnshapeFeatureListResponse {
    features: OnshapePartStudioFeature[];
}
