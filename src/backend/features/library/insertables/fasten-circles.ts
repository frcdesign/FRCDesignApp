/** Fastens inserted instances to circles picked in the target assembly. */
import {
    type OnshapeApi,
    OnshapeRateLimitError
} from "../../../lib/onshape/client";
import { type ElementPath } from "../../../lib/onshape/path";
import {
    addAssemblyFeature,
    deleteAssemblyFeature
} from "../../../lib/onshape/endpoints/assemblies";
import {
    type EdgeReference,
    fastenMateToCircle,
    replicateFeature
} from "../../../lib/onshape/objects/assembly-features";
import { type OnshapeInsertInstancesResponse } from "../../../lib/onshape/types";
import { type CircleSelection } from "../contract";

interface FastenToCirclesArgs {
    name: string;
    /** The instance already inserted, which takes the first circle. */
    inserted: OnshapeInsertInstancesResponse;
    /** Inserts one more instance, for a circle the replicate doesn't cover. */
    insert: () => Promise<OnshapeInsertInstancesResponse>;
    /** The inserted part's own connector, in the instance at `instancePath`. */
    fastenQuery: (instancePath: string[]) => object;
    circles: CircleSelection[];
    replicate: boolean;
}

/** Inserts nothing for the first circle; the caller has already. */
export async function fastenToCircles(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    args: FastenToCirclesArgs
): Promise<void> {
    const { name, inserted, insert, fastenQuery, replicate } = args;
    const [first, ...rest] = args.circles.map(toEdgeReference);

    const instancePath = getInstancePath(inserted);
    const mate = await addAssemblyFeature(
        onshapeApi,
        targetPath,
        fastenMateToCircle(name, fastenQuery(instancePath), first)
    );

    if (
        replicate &&
        rest.length > 0 &&
        (await tryReplicate(onshapeApi, targetPath, {
            name,
            instancePath,
            mateFeatureId: mate.feature.featureId,
            circles: rest
        }))
    ) {
        return;
    }

    // Serially: each is a feature-list edit, and Onshape rejects one that races another.
    for (const circle of rest) {
        const next = await insert();
        await addAssemblyFeature(
            onshapeApi,
            targetPath,
            fastenMateToCircle(name, fastenQuery(getInstancePath(next)), circle)
        );
    }
}

export function getInstancePath(
    inserted: OnshapeInsertInstancesResponse
): string[] {
    return inserted.insertInstanceResponses?.[0]?.occurrences?.[0]?.path ?? [];
}

function toEdgeReference(circle: CircleSelection): EdgeReference {
    return {
        deterministicId: circle.selectionId,
        path: circle.occurrencePath
    };
}

interface ReplicateArgs {
    name: string;
    instancePath: string[];
    mateFeatureId: string;
    circles: EdgeReference[];
}

/**
 * False when Onshape refuses the replicate or adds it broken, leaving nothing
 * behind; the caller fastens one instance per circle instead.
 */
async function tryReplicate(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    args: ReplicateArgs
): Promise<boolean> {
    const feature = replicateFeature(
        `Replicate ${args.name}`,
        args.instancePath,
        args.mateFeatureId,
        args.circles
    );
    try {
        const result = await addAssemblyFeature(
            onshapeApi,
            targetPath,
            feature
        );
        if (result.featureState?.featureStatus !== "ERROR") {
            return true;
        }
        console.warn("Replicate failed to regenerate", result.feature);
        await deleteAssemblyFeature(
            onshapeApi,
            targetPath,
            result.feature.featureId
        );
        return false;
    } catch (error) {
        // The fallback would only spend more of the same allocation.
        if (error instanceof OnshapeRateLimitError) {
            throw error;
        }
        console.warn("Onshape refused a replicate", error);
        return false;
    }
}
