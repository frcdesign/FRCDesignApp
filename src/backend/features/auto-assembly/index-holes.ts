/** Indexes an assembly's holes: reads it and scans its Part Studios for everything the planner needs. */
import { createLimiter } from "../../lib/limiter";
import { type OnshapeApi } from "../../lib/onshape/client";
import { getAssembly } from "../../lib/onshape/endpoints/assemblies";
import { getElements } from "../../lib/onshape/endpoints/documents";
import { type ElementPath } from "../../lib/onshape/path";
import { OnshapeElementType } from "../../lib/onshape/types";
import {
    type ElementMicroversions,
    isFromStudio,
    isLocal,
    partOccurrences,
    pathKey,
    placedScrews,
    selectionsByStudio,
    toAssemblyCircularEdges,
    toAssemblyHoles,
    withoutExcluded,
    type PartOccurrence
} from "./assembly";
import { FastenerKind, type FastenerSet } from "./studios";
import {
    HoleStatus,
    type PlannedHole,
    type SelectedEntity,
    SelectedEntityType
} from "./contract";
import {
    type AssemblyCircularEdge,
    type AssemblyHole,
    type PlacedScrew
} from "./planner";
import { scanStudio, type StudioScan } from "./scan";

/** Part Studios evaluated at once: each is one Onshape call, and an assembly can have dozens. */
const SCAN_CONCURRENCY = 6;

export interface IndexedHoles {
    circularEdges: AssemblyCircularEdge[];
    holes: AssemblyHole[];
    placed: PlacedScrew[];
    /** Each target that gave no circular edge, and why. */
    unfound: PlannedHole[];
}

function isFastener(
    occurrence: PartOccurrence,
    fasteners: FastenerSet | undefined
): boolean {
    return Object.values(FastenerKind).some((kind) =>
        isFromStudio(occurrence, fasteners?.studios[kind].location)
    );
}

async function localMicroversions(
    client: OnshapeApi,
    assembly: ElementPath,
    instances: { documentId?: string; documentVersion?: string }[]
): Promise<ElementMicroversions> {
    const anyLocal = instances.some(
        (instance) =>
            instance.documentVersion === undefined &&
            instance.documentId === assembly.documentId
    );
    if (!anyLocal || assembly.instanceType !== "w") {
        return new Map();
    }
    const elements = await getElements(
        client,
        assembly,
        OnshapeElementType.PART_STUDIO
    );
    return new Map(
        elements.map((element) => [element.id, element.microversionId])
    );
}

export async function indexHoles(
    client: OnshapeApi,
    kv: KVNamespace,
    assembly: ElementPath,
    targets: SelectedEntity[],
    excluded: SelectedEntity[],
    // Fasteners already placed, which have no holes to fasten through; none before the library loads them
    fasteners: FastenerSet | undefined
): Promise<IndexedHoles> {
    const definition = await getAssembly(client, assembly, {
        excludeSuppressed: true
    });
    const instances = [
        ...definition.rootAssembly.instances,
        ...definition.subAssemblies.flatMap((sub) => sub.instances ?? [])
    ];
    const microversions = await localMicroversions(
        client,
        assembly,
        instances.filter(
            (instance) =>
                instance.type === "Part" && isLocal(instance, assembly)
        )
    );
    const occurrences = partOccurrences(definition, assembly, microversions);
    const byPath = new Map(
        occurrences.map((occurrence) => [pathKey(occurrence.path), occurrence])
    );

    // Fasteners and standard content have no holes to fasten through
    const scanned = occurrences.filter(
        (occurrence) =>
            !occurrence.isStandardContent && !isFastener(occurrence, fasteners)
    );
    const selections = selectionsByStudio([...targets, ...excluded], byPath);
    const sources = new Map(
        [...scanned, ...byPathValues(byPath, [...targets, ...excluded])].map(
            (occurrence) => [occurrence.source.key, occurrence.source]
        )
    );

    const limit = createLimiter(SCAN_CONCURRENCY);
    const scans = new Map<string, StudioScan>(
        await Promise.all(
            [...sources].map(async ([key, source]) => {
                const selection = selections.get(key) ?? {
                    edges: [],
                    faces: []
                };
                const scan = await limit(() =>
                    scanStudio(client, kv, source, selection)
                );
                return [key, scan] as const;
            })
        )
    );

    const holes = scanned.flatMap((occurrence) =>
        toAssemblyHoles(
            scans.get(occurrence.source.key)?.parts[occurrence.partId]?.holes ??
                [],
            occurrence
        )
    );
    const circularEdgesOf = (entities: SelectedEntity[]) =>
        [...selections.keys()].flatMap((key) =>
            toAssemblyCircularEdges(
                scans.get(key)?.circles ?? [],
                entities.filter(
                    (entity) =>
                        byPath.get(pathKey(entity.occurrencePath))?.source
                            .key === key
                ),
                byPath
            )
        );

    const unfound = targets.flatMap((target): PlannedHole[] => {
        if (circularEdgesOf([target]).length > 0) {
            return [];
        }
        const isFound = byPath.has(pathKey(target.occurrencePath));
        if (!isFound) {
            // How Onshape describes an instance we can't walk through is the only record of why
            console.warn("Auto Assembly couldn't resolve a pick", {
                path: target.occurrencePath,
                instances: instances.filter((instance) =>
                    target.occurrencePath.includes(instance.id)
                ),
                subAssemblies: definition.subAssemblies.map((sub) => ({
                    documentId: sub.documentId,
                    elementId: sub.elementId,
                    configuration: sub.configuration,
                    fullConfiguration: sub.fullConfiguration,
                    documentMicroversion: sub.documentMicroversion
                }))
            });
        }
        return [
            {
                key: `${pathKey(target.occurrencePath)}|${target.entityId}`,
                status: HoleStatus.NO_FIT,
                reason: !isFound
                    ? "Couldn't find this part in the assembly."
                    : target.entityType === SelectedEntityType.EDGE
                      ? "Not a circular edge."
                      : "No circular edges in this face."
            }
        ];
    });

    return {
        circularEdges: withoutExcluded(
            circularEdgesOf(targets),
            circularEdgesOf(excluded)
        ),
        unfound,
        holes,
        placed: placedScrews(
            occurrences,
            fasteners?.studios[FastenerKind.SCREW].location
        )
    };
}

function byPathValues(
    byPath: Map<string, PartOccurrence>,
    entities: SelectedEntity[]
): PartOccurrence[] {
    return entities.flatMap((entity) => {
        const occurrence = byPath.get(pathKey(entity.occurrencePath));
        return occurrence ? [occurrence] : [];
    });
}
