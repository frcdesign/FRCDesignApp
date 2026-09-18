/**
 * The insert location: a marker in the assembly being inserted into, which new
 * parts land on instead of the origin. A leaf, so the frontend can name it
 * without pulling the Onshape client into the bundle.
 */
import { type ElementPath } from "../../lib/onshape/path";

/**
 * The tab the marker is inserted from. A standalone mate connector cannot be
 * created in an assembly through the API, so the app inserts a sketch that
 * carries one instead — pinned to a version, which is what makes the ids below
 * stable.
 */
export const INSERT_LOCATION_SOURCE: ElementPath = {
    documentId: "6c26fe7a89b71b80707ee3cf",
    instanceType: "v",
    instanceId: "c6bcd0ec79b93650c150fa83",
    elementId: "8252e798e07255ac1235e7e5"
};

/**
 * The sketch inside that tab: what an assembly gets an instance of. Only the
 * insert names it — recognizing a marker goes by the tab, so an assembly
 * holding one from before the sketch was redrawn still counts.
 */
export const INSERT_LOCATION_SKETCH_ID = "FoHmJsKNNEuStrH_0";

/**
 * The mate connector that sketch carries. An id in the source tab rather than
 * in any one assembly: two SELECTION messages from different assemblies
 * reported it unchanged, with only the occurrence around it differing.
 *
 * Unused — kept for whatever eventually points the caller at the marker in the
 * viewport. The frontend's `messages.ts` says how far that got.
 */
export const INSERT_LOCATION_MATE_CONNECTOR_ID = "F2t8fekeOt5UXBq_0";

export interface InsertLocationOut {
    /**
     * The marker's instance id in this assembly — not the sketch's own id,
     * which every assembly shares. Absent when the assembly has none.
     */
    instanceId?: string;
}
