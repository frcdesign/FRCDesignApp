/** Fastens inserted instances to circular edges picked in the target assembly. */
import { type OnshapeApi } from "../../../lib/onshape/client";
import { type ElementPath } from "../../../lib/onshape/path";
import { addAssemblyFeature } from "../../../lib/onshape/endpoints/assemblies";
import { fastenMateToCircularEdge } from "../../../lib/onshape/objects/assembly-features";
import { type OnshapeInsertInstancesResponse } from "../../../lib/onshape/types";
import { type AssemblyCircularEdge } from "../../quick-fastener/planner";
import {
    addReplicate,
    sameRadius,
    toEdgeReference
} from "../../quick-fastener/replicate";

interface FastenToCircularEdgesArgs {
    name: string;
    /** The instance already inserted, which takes the first edge. */
    inserted: OnshapeInsertInstancesResponse;
    /** Inserts one more instance, for an edge no Replicate covers. */
    insert: () => Promise<OnshapeInsertInstancesResponse>;
    /** The inserted part's own connector, in the instance at `instancePath`. */
    fastenQuery: (instancePath: string[]) => object;
    /** From `indexHoles`, in the order picked. */
    edges: AssemblyCircularEdge[];
    replicate: boolean;
}

/**
 * A Replicate only matches edges the size of its seed's, so with `replicate`
 * each size gets its own fastened instance and Replicate; without, each edge
 * gets an instance. Inserts nothing for the first edge;
 * the caller has already.
 */
export async function fastenToCircularEdges(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    args: FastenToCircularEdgesArgs
): Promise<void> {
    const { name, inserted, insert, fastenQuery, replicate } = args;
    const groups = replicate
        ? groupBySize(args.edges)
        : args.edges.map((edge) => [edge]);

    // Serially: each is a feature-list edit, and Onshape rejects one that races another.
    let seed: OnshapeInsertInstancesResponse | undefined = inserted;
    for (const group of groups) {
        const [first, ...rest] = group;
        const instancePath = getInstancePath(seed ?? (await insert()));
        seed = undefined;
        const mate = await addAssemblyFeature(
            onshapeApi,
            targetPath,
            fastenMateToCircularEdge(
                name,
                fastenQuery(instancePath),
                toEdgeReference(first)
            )
        );

        if (rest.length > 0) {
            await addReplicate(onshapeApi, targetPath, {
                name,
                instancePaths: [instancePath],
                mateFeatureId: mate.feature.featureId,
                edges: rest.map(toEdgeReference)
            });
        }
    }
}

export function getInstancePath(
    inserted: OnshapeInsertInstancesResponse
): string[] {
    return inserted.insertInstanceResponses?.[0]?.occurrences?.[0]?.path ?? [];
}

/** In the order picked, each size where it first appears. */
export function groupBySize(
    edges: AssemblyCircularEdge[]
): AssemblyCircularEdge[][] {
    const groups: AssemblyCircularEdge[][] = [];
    for (const edge of edges) {
        const group = groups.find((candidate) =>
            sameRadius(candidate[0], edge)
        );
        if (group) {
            group.push(edge);
        } else {
            groups.push([edge]);
        }
    }
    return groups;
}
