/**
 * Hand-authored types for the Onshape assembly endpoints (only the subset we read).
 *
 * The assembly definition is a large, deeply polymorphic feature tree; we consume just a
 * few fields, so these are hand-written rather than generated.
 */

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
