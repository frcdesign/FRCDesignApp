/** Fastens inserted instances to circles picked in the target assembly. */
import {
    type OnshapeApi,
    OnshapeRateLimitError
} from "../../../lib/onshape/client";
import { type ElementPath } from "../../../lib/onshape/path";
import { addAssemblyFeature } from "../../../lib/onshape/endpoints/assemblies";
import {
    type EdgeReference,
    fastenMateToCircle,
    replicateFeature
} from "../../../lib/onshape/objects/assembly-features";
import { type OnshapeInsertInstancesResponse } from "../../../lib/onshape/types";
import { type CircleSelection } from "../contract";
import { getCircleRadii } from "./circle-radii";
import { tolerantEquals } from "../../configurations/input-parser";

interface FastenToCirclesArgs {
    name: string;
    /** The instance already inserted, which takes the first circle. */
    inserted: OnshapeInsertInstancesResponse;
    /** Inserts one more instance, for a circle no replicate covers. */
    insert: () => Promise<OnshapeInsertInstancesResponse>;
    /** The inserted part's own connector, in the instance at `instancePath`. */
    fastenQuery: (instancePath: string[]) => object;
    circles: CircleSelection[];
    replicate: boolean;
}

/**
 * A Replicate only matches circles the size of its seed's, so with `replicate`
 * each size gets its own fastened instance and Replicate. Inserts nothing for
 * the first circle; the caller has already.
 */
export async function fastenToCircles(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    args: FastenToCirclesArgs
): Promise<void> {
    const { name, inserted, insert, fastenQuery, replicate } = args;
    const sizes =
        replicate && args.circles.length > 1
            ? await groupBySize(onshapeApi, targetPath, args.circles)
            : args.circles.map((circle) => [circle]);

    // Serially: each is a feature-list edit, and Onshape rejects one that races another.
    let seed: OnshapeInsertInstancesResponse | undefined = inserted;
    for (const size of sizes) {
        const [first, ...rest] = size.map(toEdgeReference);
        const instancePath = getInstancePath(seed ?? (await insert()));
        seed = undefined;
        const mate = await addAssemblyFeature(
            onshapeApi,
            targetPath,
            fastenMateToCircle(name, fastenQuery(instancePath), first)
        );

        if (
            rest.length > 0 &&
            (await tryReplicate(onshapeApi, targetPath, {
                name,
                instancePath,
                mateFeatureId: mate.feature.featureId,
                circles: rest
            }))
        ) {
            continue;
        }

        for (const circle of rest) {
            const next = await insert();
            await addAssemblyFeature(
                onshapeApi,
                targetPath,
                fastenMateToCircle(
                    name,
                    fastenQuery(getInstancePath(next)),
                    circle
                )
            );
        }
    }
}

/**
 * In the order picked. A circle whose size can't be read stands alone, as do
 * all of them when the read fails.
 */
async function groupBySize(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    circles: CircleSelection[]
): Promise<CircleSelection[][]> {
    let radii: (number | undefined)[];
    try {
        radii = await getCircleRadii(onshapeApi, targetPath, circles);
    } catch (error) {
        rethrowRateLimit(error);
        console.warn("Failed to read circle sizes", error);
        return circles.map((circle) => [circle]);
    }

    const sizes: { radius: number; circles: CircleSelection[] }[] = [];
    const groups: CircleSelection[][] = [];
    for (const [index, circle] of circles.entries()) {
        const radius = radii[index];
        if (radius === undefined) {
            groups.push([circle]);
            continue;
        }
        const size = sizes.find((candidate) =>
            tolerantEquals(
                { value: candidate.radius, type: "length" },
                { value: radius, type: "length" }
            )
        );
        if (size) {
            size.circles.push(circle);
        } else {
            const created = { radius, circles: [circle] };
            sizes.push(created);
            groups.push(created.circles);
        }
    }
    return groups;
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

/** False when Onshape refuses it; the caller fastens one instance per circle instead. */
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
        await addAssemblyFeature(onshapeApi, targetPath, feature);
        return true;
    } catch (error) {
        rethrowRateLimit(error);
        console.warn("Onshape refused a replicate", error);
        return false;
    }
}

/** A fallback would only spend more of the same allocation. */
function rethrowRateLimit(error: unknown): void {
    if (error instanceof OnshapeRateLimitError) {
        throw error;
    }
}
