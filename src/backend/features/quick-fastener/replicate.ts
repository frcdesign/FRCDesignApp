/**
 * Replicates, shared by insert and fasten and Quick fastener: what a seed's
 * Replicate matches, and adding one.
 */
import { HttpStatus } from "http-status-ts";
import { handledError } from "../../lib/api-error";
import { type OnshapeApi } from "../../lib/onshape/client";
import { onshapeStatus } from "../../lib/onshape/failures";
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
 * What a Replicate of the group's first edge onto the rest matches: its faces,
 * when the group is every edge of the seed's size on whole picked faces (of
 * all the edges gathered), else its edges.
 */
export function replicateMatch(
    group: AssemblyCircularEdge[],
    all: AssemblyCircularEdge[]
): ReplicateMatch {
    const [seed, ...rest] = group;
    const byEdges: ReplicateMatch = { edges: rest.map(toEdgeReference) };
    if (group.some((edge) => edge.face === undefined)) {
        return byEdges;
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
        return byEdges;
    }
    return {
        faces: faces.map((edge) => ({
            deterministicId: edge.face ?? "",
            path: edge.occurrencePath
        }))
    };
}

export interface ReplicateArgs {
    name: string;
    /** The seed's instances, each copied onto every match. */
    instancePaths: string[][];
    /** The mate placing the seed, which each copy is placed as. */
    mateFeatureId: string;
    match: ReplicateMatch;
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
                args.match
            )
        );
    } catch (error) {
        if (onshapeStatus(error) !== HttpStatus.BAD_REQUEST) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw handledError(
            `Onshape refused the Replicate (${message}).`,
            HttpStatus.BAD_GATEWAY
        );
    }
}
