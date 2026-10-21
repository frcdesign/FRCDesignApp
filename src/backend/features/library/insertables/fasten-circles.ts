/** Fastens inserted instances to circles picked in the target assembly. */
import {
    type OnshapeApi,
    OnshapeRateLimitError
} from "../../../lib/onshape/client";
import { type ElementPath } from "../../../lib/onshape/path";
import {
    addAssemblyFeature,
    getAssembly,
    getAssemblyFeatures,
    updateAssemblyFeature
} from "../../../lib/onshape/endpoints/assemblies";
import {
    type EdgeReference,
    edgeQuery,
    fastenMateToCircle,
    OCCURRENCE_QUERY_BT_TYPE,
    REPLICATE_BT_TYPE,
    replicateFeature
} from "../../../lib/onshape/objects/assembly-features";
import {
    type OnshapeAssemblyInstance,
    type OnshapeFeatureParameter,
    type OnshapeInsertInstancesResponse,
    type OnshapeQuery
} from "../../../lib/onshape/types";
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

/** What an insert would place: the library's version of a tab, configured. */
export interface InsertSource {
    sourcePath: ElementPath;
    configuration?: string;
}

/**
 * Adds the circles to a Replicate already seeded with the same insert, so the
 * assembly keeps one per part. False when there is none to extend.
 */
export async function extendReplicate(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    source: InsertSource,
    circles: CircleSelection[]
): Promise<boolean> {
    try {
        const { features } = await getAssemblyFeatures(onshapeApi, targetPath);
        const replicates = features.filter(
            (feature) => feature.btType === REPLICATE_BT_TYPE
        );
        if (replicates.length === 0) {
            return false;
        }

        const { rootAssembly } = await getAssembly(onshapeApi, targetPath);
        for (const replicate of replicates) {
            const parameters = findReplicateParameters(replicate.parameters);
            const seed =
                parameters &&
                rootAssembly.instances.find(
                    (instance) => instance.id === parameters.seedPath[0]
                );
            if (!parameters || !seed || !isSameInsert(seed, source)) {
                continue;
            }

            const matched = new Set(
                parameters.targets.queries?.map((query) =>
                    edgeKey(query.path ?? [], query.deterministicIds?.[0])
                )
            );
            const added = circles
                .map(toEdgeReference)
                .filter(
                    (edge) =>
                        !matched.has(edgeKey(edge.path, edge.deterministicId))
                );
            if (added.length > 0) {
                parameters.targets.queries = [
                    ...(parameters.targets.queries ?? []),
                    ...added.map((edge) => edgeQuery(edge) as OnshapeQuery)
                ];
                await updateAssemblyFeature(
                    onshapeApi,
                    targetPath,
                    replicate.featureId,
                    replicate
                );
            }
            return true;
        }
        return false;
    } catch (error) {
        rethrowRateLimit(error);
        console.warn("Failed to extend a replicate", error);
        return false;
    }
}

/**
 * Found by what they hold rather than by id, so a Replicate made in Onshape
 * qualifies too: the seed is a top-level instance, and the targets are edges.
 */
function findReplicateParameters(
    parameters: OnshapeFeatureParameter[] = []
): { seedPath: string[]; targets: OnshapeFeatureParameter } | undefined {
    const queryLists = parameters.filter(
        (parameter) => parameter.queries !== undefined
    );
    const seed = queryLists
        .flatMap((parameter) => parameter.queries ?? [])
        .find((query) => query.btType === OCCURRENCE_QUERY_BT_TYPE);
    const targets = queryLists.find((parameter) =>
        parameter.queries?.some((query) => query.deterministicIds?.length)
    );
    if (!seed?.path || seed.path.length !== 1 || !targets) {
        return undefined;
    }
    return { seedPath: seed.path, targets };
}

function edgeKey(path: string[], deterministicId: string | undefined): string {
    return `${path.join("/")}:${deterministicId}`;
}

function isSameInsert(
    instance: OnshapeAssemblyInstance,
    { sourcePath, configuration }: InsertSource
): boolean {
    return (
        instance.documentId === sourcePath.documentId &&
        instance.elementId === sourcePath.elementId &&
        instance.documentVersion === sourcePath.instanceId &&
        normalizeConfiguration(instance.configuration) ===
            normalizeConfiguration(configuration)
    );
}

/** Onshape's spelling of an instance's configuration is undocumented; "default" is none. */
function normalizeConfiguration(configuration: string | undefined): string {
    if (!configuration || configuration === "default") {
        return "";
    }
    try {
        return decodeURIComponent(configuration);
    } catch {
        return configuration;
    }
}

/** A fallback would only spend more of the same allocation. */
function rethrowRateLimit(error: unknown): void {
    if (error instanceof OnshapeRateLimitError) {
        throw error;
    }
}
