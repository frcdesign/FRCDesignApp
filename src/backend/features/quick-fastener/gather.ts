/** Reads an assembly and scans its Part Studios: everything the planner needs. */
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
import { FastenerKind, getStudioLocation } from "./catalog";
import { type SelectedEntity } from "./contract";
import {
    type AssemblyCircularEdge,
    type AssemblyHole,
    type PlacedScrew
} from "./planner";
import { scanStudio, type StudioScan } from "./scan";

/** Part Studios evaluated at once: each is one Onshape call, and an assembly can have dozens. */
const SCAN_CONCURRENCY = 6;

export interface Gathered {
    circularEdges: AssemblyCircularEdge[];
    holes: AssemblyHole[];
    placed: PlacedScrew[];
}

function isFastener(occurrence: PartOccurrence): boolean {
    return Object.values(FastenerKind).some((kind) =>
        isFromStudio(occurrence, getStudioLocation(kind))
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

export async function gather(
    client: OnshapeApi,
    kv: KVNamespace,
    assembly: ElementPath,
    targets: SelectedEntity[],
    excluded: SelectedEntity[]
): Promise<Gathered> {
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
        (occurrence) => !occurrence.isStandardContent && !isFastener(occurrence)
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

    return {
        circularEdges: withoutExcluded(
            circularEdgesOf(targets),
            circularEdgesOf(excluded)
        ),
        holes,
        placed: placedScrews(occurrences, getStudioLocation(FastenerKind.SCREW))
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
