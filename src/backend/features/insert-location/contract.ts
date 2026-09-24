/** A marker in an assembly that new parts land on. A leaf, so the frontend can import it. */
import { type ElementPath } from "../../lib/onshape/path";

/**
 * The API can't create a standalone mate connector in an assembly, so a sketch
 * carrying one is inserted instead, from a pinned version so the ids are stable.
 */
export const INSERT_LOCATION_SOURCE: ElementPath = {
    documentId: "6c26fe7a89b71b80707ee3cf",
    instanceType: "v",
    instanceId: "c6bcd0ec79b93650c150fa83",
    elementId: "8252e798e07255ac1235e7e5"
};

/** Only inserts use it; recognizing a marker goes by the tab. */
export const INSERT_LOCATION_SKETCH_ID = "FoHmJsKNNEuStrH_0";

/** Unused, kept for pointing the caller at the marker; see `messages.ts`. */
export const INSERT_LOCATION_MATE_CONNECTOR_ID = "F2t8fekeOt5UXBq_0";

export interface InsertLocationOut {
    /** Not the sketch's id, which every assembly shares. */
    instanceId?: string;
}
