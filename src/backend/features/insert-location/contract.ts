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
    instanceId: "a4b5bec2c4085e3b36623327",
    elementId: "8252e798e07255ac1235e7e5"
};

/**
 * The sketch inside that tab. An assembly instance of a sketch names the
 * feature it came from, which is how one is told from any other insert.
 */
export const INSERT_LOCATION_SKETCH_ID = "FoHmJsKNNEuStrH_0";

/** What the sketch is called, and so what the assembly shows it as. */
export const INSERT_LOCATION_NAME = "Insert location";

export interface InsertLocationOut {
    /**
     * The marker's instance id in this assembly — not the sketch's own id,
     * which every assembly shares. Null when the assembly has no insert
     * location.
     */
    instanceId: string | null;
}
