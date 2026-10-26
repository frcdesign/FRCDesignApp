/**
 * Replicates, shared by insert and fasten and Quick fastener: which edges a
 * seed's Replicate can match, and adding one.
 */
import { HttpStatus } from "http-status-ts";
import { handledError } from "../../lib/api-error";
import { type OnshapeApi } from "../../lib/onshape/client";
import { onshapeStatus } from "../../lib/onshape/failures";
import { addAssemblyFeature } from "../../lib/onshape/endpoints/assemblies";
import {
    type EdgeReference,
    replicateFeature
} from "../../lib/onshape/objects/assembly-features";
import { type ElementPath } from "../../lib/onshape/path";
import { tolerantEquals } from "../configurations/input-parser";
import { type AssemblyCircularEdge } from "./planner";

/** Onshape only matches edges the seed's size, within its length tolerance. */
export function sameRadius(
    a: AssemblyCircularEdge,
    b: AssemblyCircularEdge
): boolean {
    return tolerantEquals(
        { value: a.radius, type: "length" },
        { value: b.radius, type: "length" }
    );
}

export function toEdgeReference(edge: AssemblyCircularEdge): EdgeReference {
    return { deterministicId: edge.edgeId, path: edge.occurrencePath };
}

export interface ReplicateArgs {
    name: string;
    /** The seed's instances, each copied onto every match. */
    instancePaths: string[][];
    /** The mate placing the seed, which each copy is placed as. */
    mateFeatureId: string;
    /** Each the size of the seed mate's edge. */
    edges: EdgeReference[];
}

/** Adds a Replicate; Onshape refusing it is an error in the user's words, with Onshape's own. */
export async function addReplicate(
    onshapeApi: OnshapeApi,
    assembly: ElementPath,
    args: ReplicateArgs
): Promise<void> {
    try {
        await addAssemblyFeature(
            onshapeApi,
            assembly,
            replicateFeature(
                args.name,
                args.instancePaths,
                args.mateFeatureId,
                args.edges
            )
        );
    } catch (error) {
        if (onshapeStatus(error) !== HttpStatus.BAD_REQUEST) {
            throw error;
        }
        // Onshape's words are for developers
        console.error("Onshape refused a Replicate", error);
        throw handledError(
            "Onshape refused the Replicate.",
            HttpStatus.BAD_GATEWAY
        );
    }
}
