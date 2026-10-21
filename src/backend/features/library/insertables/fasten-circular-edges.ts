/** Fastens inserted instances to circular edges picked in the target assembly. */
import {
    type OnshapeApi,
    OnshapeRateLimitError
} from "../../../lib/onshape/client";
import { type ElementPath } from "../../../lib/onshape/path";
import { addAssemblyFeature } from "../../../lib/onshape/endpoints/assemblies";
import {
    type EdgeReference,
    fastenMateToCircularEdge,
    replicateFeature
} from "../../../lib/onshape/objects/assembly-features";
import { type OnshapeInsertInstancesResponse } from "../../../lib/onshape/types";
import { tolerantEquals } from "../../configurations/input-parser";
import { type AssemblyCircularEdge } from "../../quick-fastener/planner";

interface FastenToCircularEdgesArgs {
    name: string;
    /** The instance already inserted, which takes the first edge. */
    inserted: OnshapeInsertInstancesResponse;
    /** Inserts one more instance, for an edge no replicate covers. */
    insert: () => Promise<OnshapeInsertInstancesResponse>;
    /** The inserted part's own connector, in the instance at `instancePath`. */
    fastenQuery: (instancePath: string[]) => object;
    /** From `gather`, in the order picked. */
    edges: AssemblyCircularEdge[];
    replicate: boolean;
}

/**
 * A Replicate only matches edges the diameter of its seed's, so with
 * `replicate` each diameter gets its own fastened instance and Replicate.
 * Inserts nothing for the first edge; the caller has already.
 */
export async function fastenToCircularEdges(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    args: FastenToCircularEdgesArgs
): Promise<void> {
    const { name, inserted, insert, fastenQuery, replicate } = args;
    const groups = replicate
        ? groupByDiameter(args.edges)
        : args.edges.map((edge) => [edge]);

    // Serially: each is a feature-list edit, and Onshape rejects one that races another.
    let seed: OnshapeInsertInstancesResponse | undefined = inserted;
    for (const group of groups) {
        const [first, ...rest] = group.map(toEdgeReference);
        const instancePath = getInstancePath(seed ?? (await insert()));
        seed = undefined;
        const mate = await addAssemblyFeature(
            onshapeApi,
            targetPath,
            fastenMateToCircularEdge(name, fastenQuery(instancePath), first)
        );

        if (
            rest.length > 0 &&
            (await tryReplicate(onshapeApi, targetPath, {
                name,
                instancePath,
                mateFeatureId: mate.feature.featureId,
                edges: rest
            }))
        ) {
            continue;
        }

        for (const edge of rest) {
            const next = await insert();
            await addAssemblyFeature(
                onshapeApi,
                targetPath,
                fastenMateToCircularEdge(
                    name,
                    fastenQuery(getInstancePath(next)),
                    edge
                )
            );
        }
    }
}

export function getInstancePath(
    inserted: OnshapeInsertInstancesResponse
): string[] {
    return inserted.insertInstanceResponses?.[0]?.occurrences?.[0]?.path ?? [];
}

/** In the order picked, each diameter where it first appears. */
export function groupByDiameter(
    edges: AssemblyCircularEdge[]
): AssemblyCircularEdge[][] {
    const groups: AssemblyCircularEdge[][] = [];
    for (const edge of edges) {
        const group = groups.find((candidate) =>
            tolerantEquals(
                { value: candidate[0].radius, type: "length" },
                { value: edge.radius, type: "length" }
            )
        );
        if (group) {
            group.push(edge);
        } else {
            groups.push([edge]);
        }
    }
    return groups;
}

function toEdgeReference(edge: AssemblyCircularEdge): EdgeReference {
    return { deterministicId: edge.edgeId, path: edge.occurrencePath };
}

interface ReplicateArgs {
    name: string;
    instancePath: string[];
    mateFeatureId: string;
    edges: EdgeReference[];
}

/** False when Onshape refuses it; the caller fastens one instance per edge instead. */
async function tryReplicate(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    args: ReplicateArgs
): Promise<boolean> {
    const feature = replicateFeature(
        `Replicate ${args.name}`,
        args.instancePath,
        args.mateFeatureId,
        args.edges
    );
    try {
        await addAssemblyFeature(onshapeApi, targetPath, feature);
        return true;
    } catch (error) {
        // A fallback would only spend more of the same allocation.
        if (error instanceof OnshapeRateLimitError) {
            throw error;
        }
        console.warn("Onshape refused a replicate", error);
        return false;
    }
}
