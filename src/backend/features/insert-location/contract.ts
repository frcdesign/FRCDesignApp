/**
 * The insert location: a mate connector in the assembly being inserted into,
 * which new parts land on instead of the origin. A leaf, so the frontend can
 * name it without pulling the Onshape client into the bundle.
 */

/** What the app names the connector, and the only way it finds one again. */
export const INSERT_LOCATION_NAME = "Insert location";

export interface InsertLocationOut {
    /** The connector's feature id; null when the assembly has no insert location. */
    mateConnectorId: string | null;
}
