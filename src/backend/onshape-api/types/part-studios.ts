/**
 * Hand-authored types for the Onshape part studio feature endpoint (the subset we read).
 */

/** A feature in a part studio. */
export interface OnshapePartStudioFeature {
    featureType: string;
    featureId: string;
}

/** GET /partstudios/d/{did}/{wvm}/{wvmid}/e/{eid}/features (the subset we read). */
export interface OnshapeFeatureListResponse {
    features: OnshapePartStudioFeature[];
}
