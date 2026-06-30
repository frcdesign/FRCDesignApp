/**
 * Hand-authored types for the Onshape versions endpoint (the subset we read).
 * See `../generated` for the @hey-api reference slice.
 */

/** An item from GET /documents/d/{did}/versions. */
export interface OnshapeVersionInfo {
    id: string;
    name: string;
    /** ISO-8601 timestamp. */
    createdAt: string;
}
