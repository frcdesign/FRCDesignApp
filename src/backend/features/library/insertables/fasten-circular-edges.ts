/** Fastens inserted instances to circular edges picked in the target assembly. */
import { type OnshapeApi } from "../../../lib/onshape/client";
import { type ElementPath } from "../../../lib/onshape/path";
import { addAssemblyFeature } from "../../../lib/onshape/endpoints/assemblies";
import {
    type EdgeReference,
    fastenMateToCircularEdge
} from "../../../lib/onshape/objects/assembly-features";
import { type OnshapeInsertInstancesResponse } from "../../../lib/onshape/types";
import { type AssemblyCircularEdge } from "../../quick-fastener/planner";

interface FastenToCircularEdgesArgs {
    name: string;
    /** The instance already inserted, which takes the first edge. */
    inserted: OnshapeInsertInstancesResponse;
    /** Inserts one more instance, for each edge after the first. */
    insert: () => Promise<OnshapeInsertInstancesResponse>;
    /** The inserted part's own connector, in the instance at `instancePath`. */
    fastenQuery: (instancePath: string[]) => object;
    /** From `indexHoles`, in the order picked. */
    edges: AssemblyCircularEdge[];
}

/** Each edge gets an instance fastened to it. Inserts nothing for the first edge; the caller has already. */
export async function fastenToCircularEdges(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    args: FastenToCircularEdgesArgs
): Promise<void> {
    const { name, inserted, insert, fastenQuery, edges } = args;
    // Serially: each is a feature-list edit, and Onshape rejects one that races another.
    let seed: OnshapeInsertInstancesResponse | undefined = inserted;
    for (const edge of edges) {
        const instancePath = getInstancePath(seed ?? (await insert()));
        seed = undefined;
        await addAssemblyFeature(
            onshapeApi,
            targetPath,
            fastenMateToCircularEdge(
                name,
                fastenQuery(instancePath),
                toEdgeReference(edge)
            )
        );
    }
}

function toEdgeReference(edge: AssemblyCircularEdge): EdgeReference {
    return { deterministicId: edge.edgeId, path: edge.occurrencePath };
}

export function getInstancePath(
    inserted: OnshapeInsertInstancesResponse
): string[] {
    return inserted.insertInstanceResponses?.[0]?.occurrences?.[0]?.path ?? [];
}
