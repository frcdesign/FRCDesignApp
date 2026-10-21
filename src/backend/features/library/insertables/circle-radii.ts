/** Reads the radius of each circle picked in an assembly, from the part it lies on. */
import { type OnshapeApi } from "../../../lib/onshape/client";
import { type ElementPath } from "../../../lib/onshape/path";
import { getAssembly } from "../../../lib/onshape/endpoints/assemblies";
import { getPartBodyDetails } from "../../../lib/onshape/endpoints/parts";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeAssemblyInstance
} from "../../../lib/onshape/types";
import { type CircleSelection } from "../contract";

/** A part instance's source, which its body details are read from. */
interface PartSource {
    path: ElementPath;
    partId: string;
    configuration?: string;
}

/**
 * In metres, in the order given; undefined where the edge's part can't be
 * found or the edge isn't a circle. One body details read per distinct part.
 */
export async function getCircleRadii(
    onshapeApi: OnshapeApi,
    targetPath: ElementPath,
    circles: CircleSelection[]
): Promise<(number | undefined)[]> {
    const assembly = await getAssembly(onshapeApi, targetPath);
    const sources = circles.map((circle) =>
        findPartSource(assembly, circle.occurrencePath)
    );

    const radiiByPart = new Map<string, Promise<Map<string, number>>>();
    for (const source of sources) {
        const key = source && sourceKey(source);
        if (source && key && !radiiByPart.has(key)) {
            radiiByPart.set(key, readEdgeRadii(onshapeApi, source));
        }
    }

    return Promise.all(
        circles.map(async (circle, index) => {
            const source = sources[index];
            const radii = source && (await radiiByPart.get(sourceKey(source)));
            return radii?.get(circle.selectionId);
        })
    );
}

/** Walks the occurrence path through each subassembly to the part instance at its end. */
function findPartSource(
    assembly: OnshapeAssemblyDefinition,
    occurrencePath: string[]
): PartSource | undefined {
    let instances: OnshapeAssemblyInstance[] = assembly.rootAssembly.instances;
    let instance: OnshapeAssemblyInstance | undefined;
    for (const [depth, id] of occurrencePath.entries()) {
        instance = instances.find((candidate) => candidate.id === id);
        if (!instance) {
            return undefined;
        }
        if (depth < occurrencePath.length - 1) {
            const {
                documentId,
                elementId,
                documentMicroversion,
                configuration
            } = instance;
            instances =
                assembly.subAssemblies.find(
                    (sub) =>
                        sub.documentId === documentId &&
                        sub.elementId === elementId &&
                        sub.documentMicroversion === documentMicroversion &&
                        sub.configuration === configuration
                )?.instances ?? [];
        }
    }

    const { documentId, elementId, documentMicroversion, partId } =
        instance ?? {};
    if (!documentId || !elementId || !documentMicroversion || !partId) {
        return undefined;
    }
    return {
        path: {
            documentId,
            instanceType: "m",
            instanceId: documentMicroversion,
            elementId
        },
        partId,
        // Onshape's spelling of no configuration.
        configuration:
            instance?.configuration === "default"
                ? undefined
                : instance?.configuration
    };
}

function sourceKey(source: PartSource): string {
    const { path, partId, configuration } = source;
    return [
        path.documentId,
        path.instanceId,
        path.elementId,
        partId,
        configuration
    ].join("|");
}

async function readEdgeRadii(
    onshapeApi: OnshapeApi,
    source: PartSource
): Promise<Map<string, number>> {
    const details = await getPartBodyDetails(
        onshapeApi,
        source.path,
        source.partId,
        source.configuration
    );
    const radii = new Map<string, number>();
    for (const edge of details.bodies.flatMap((body) => body.edges ?? [])) {
        if (edge.curve?.radius !== undefined) {
            radii.set(edge.id, edge.curve.radius);
        }
    }
    return radii;
}
