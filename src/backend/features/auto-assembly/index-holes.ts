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
    placedScrew,
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
import { type Replacement, screwLength, seatEdge, stackParts } from "./replace";

/** Part Studios evaluated at once: each is one Onshape call, and an assembly can have dozens. */
const SCAN_CONCURRENCY = 6;

export interface IndexedHoles {
    circularEdges: AssemblyCircularEdge[];
    holes: AssemblyHole[];
    placed: PlacedScrew[];
    /** Each target that gave no circular edge, and each screw to replace that can't be, and why. */
    unfound: PlannedHole[];
    /** The screws to replace, whose holes are among `circularEdges`. */
    replacements: Replacement[];
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
    fasteners: FastenerSet | undefined,
    /** Picks on screws whose stacks are taken out and their holes planned again. */
    replaced: SelectedEntity[] = []
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

    const replacing = screwsToReplace(replaced, byPath, fasteners);
    const seats = replacing.screws.flatMap(
        (screw): { screw: PartOccurrence; seat: AssemblyCircularEdge }[] => {
            const seat =
                fasteners &&
                seatEdge(
                    placedScrew(screw),
                    holes,
                    maxWasherThickness(fasteners)
                );
            return seat ? [{ screw, seat }] : [];
        }
    );
    const seated = new Set(seats.map(({ screw }) => pathKey(screw.path)));
    const replacements = seats.map(({ screw, seat }): Replacement => {
        const length = fasteners && screwLength(fasteners, screw);
        const stack =
            fasteners && length !== undefined
                ? stackParts(screw, length, occurrences, fasteners)
                : [];
        return {
            key: seat.key,
            // Only top-level instances are deleted, as only they are inserted
            instanceIds: [screw, ...stack]
                .filter((part) => part.path.length === 1)
                .map((part) => part.path[0])
        };
    });
    const picked = withoutExcluded(
        circularEdgesOf(targets),
        circularEdgesOf(excluded)
    );
    const pickedKeys = new Set(picked.map((circularEdge) => circularEdge.key));

    return {
        circularEdges: [
            ...picked,
            ...seats
                .map(({ seat }) => seat)
                .filter((seat) => !pickedKeys.has(seat.key))
        ],
        unfound: [
            ...unfound,
            ...replacing.unfound,
            ...replacing.screws
                .filter((screw) => !seated.has(pathKey(screw.path)))
                .map(
                    (screw): PlannedHole => ({
                        key: pathKey(screw.path),
                        status: HoleStatus.NO_FIT,
                        reason: "Couldn't find the hole this screw is in."
                    })
                )
        ],
        holes,
        // A screw being replaced leaves its hole free to plan again
        placed: placedScrews(
            occurrences.filter(
                (occurrence) => !seated.has(pathKey(occurrence.path))
            ),
            fasteners?.studios[FastenerKind.SCREW].location
        ),
        replacements
    };
}

function maxWasherThickness(fasteners: FastenerSet): number {
    return Math.max(
        0,
        ...fasteners.catalog.washers.map((washer) => washer.thickness)
    );
}

/** The library screws picked, each once, and why any other pick isn't one. */
function screwsToReplace(
    picks: SelectedEntity[],
    byPath: Map<string, PartOccurrence>,
    fasteners: FastenerSet | undefined
): { screws: PartOccurrence[]; unfound: PlannedHole[] } {
    const screws = new Map<string, PartOccurrence>();
    const unfound: PlannedHole[] = [];
    for (const pick of picks) {
        const occurrence = byPath.get(pathKey(pick.occurrencePath));
        let reason: string | undefined;
        if (!occurrence) {
            reason = "Couldn't find this part in the assembly.";
        } else if (
            !isFromStudio(
                occurrence,
                fasteners?.studios[FastenerKind.SCREW].location
            )
        ) {
            reason = "Not a screw from FRCDesignLib's Fasteners group.";
        } else if (occurrence.path.length > 1) {
            reason =
                "This screw is in a subassembly, which Auto Assembly doesn't change.";
        }
        if (reason || !occurrence) {
            unfound.push({
                key: `${pathKey(pick.occurrencePath)}|${pick.entityId}`,
                status: HoleStatus.NO_FIT,
                reason
            });
            continue;
        }
        screws.set(pathKey(occurrence.path), occurrence);
    }
    return { screws: [...screws.values()], unfound };
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
