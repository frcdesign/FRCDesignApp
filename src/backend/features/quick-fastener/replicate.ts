/**
 * Replicates, shared by insert and fasten and Quick fastener: what a seed's
 * Replicate matches, and adding one, matching faces where it can.
 */
import {
    OnshapeRateLimitError,
    type OnshapeApi
} from "../../lib/onshape/client";
import { addAssemblyFeature } from "../../lib/onshape/endpoints/assemblies";
import {
    type EdgeReference,
    type ReplicateMatch,
    replicateFeature
} from "../../lib/onshape/objects/assembly-features";
import { type ElementPath } from "../../lib/onshape/path";
import { tolerantEquals } from "../configurations/input-parser";
import { pathKey } from "./assembly";
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

/**
 * What a Replicate of the group's first edge onto the rest matches, in the
 * order to try: its faces, when the group is every edge of the seed's size on
 * whole picked faces (of all the edges gathered), then its edges.
 */
export function replicateMatches(
    group: AssemblyCircularEdge[],
    all: AssemblyCircularEdge[]
): ReplicateMatch[] {
    const [seed, ...rest] = group;
    const byEdges: ReplicateMatch = { edges: rest.map(toEdgeReference) };
    if (group.some((edge) => edge.face === undefined)) {
        return [byEdges];
    }
    const onFace = (edge: AssemblyCircularEdge, face: AssemblyCircularEdge) =>
        edge.face === face.face &&
        pathKey(edge.occurrencePath) === pathKey(face.occurrencePath);
    const faces = group.filter(
        (edge, index) =>
            group.findIndex((other) => onFace(other, edge)) === index
    );
    const keys = new Set(group.map((edge) => edge.key));
    const isWhole = all.every(
        (edge) =>
            keys.has(edge.key) ||
            !sameRadius(edge, seed) ||
            !faces.some((face) => onFace(edge, face))
    );
    if (!isWhole) {
        return [byEdges];
    }
    const byFaces: ReplicateMatch = {
        faces: faces.map((edge) => ({
            deterministicId: edge.face ?? "",
            path: edge.occurrencePath
        }))
    };
    return [byFaces, byEdges];
}

export interface ReplicateArgs {
    name: string;
    /** The seed's instances, each copied onto every match. */
    instancePaths: string[][];
    /** The mate placing the seed, which each copy is placed as. */
    mateFeatureId: string;
    matches: ReplicateMatch[];
}

/**
 * Adds a Replicate with the first match Onshape takes; false when it refuses
 * them all, for the caller to place the rest one by one.
 */
export async function addReplicate(
    onshapeApi: OnshapeApi,
    assembly: ElementPath,
    args: ReplicateArgs
): Promise<boolean> {
    for (const match of args.matches) {
        try {
            await addAssemblyFeature(
                onshapeApi,
                assembly,
                replicateFeature(
                    args.name,
                    args.instancePaths,
                    args.mateFeatureId,
                    match
                )
            );
            return true;
        } catch (error) {
            // Another try would only spend more of the same allocation
            if (error instanceof OnshapeRateLimitError) {
                throw error;
            }
            console.warn("Onshape refused a replicate", error);
        }
    }
    return false;
}
