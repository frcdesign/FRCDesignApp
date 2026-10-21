/**
 * The assembly, as Quick fastener sees it: each part occurrence with where it
 * sits and the Part Studio edit it's from, and the scans' holes and circles
 * moved into the assembly's coordinates. Pure.
 */
import { type ElementPath } from "../../lib/onshape/path";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeAssemblyInstance
} from "../../lib/onshape/types";
import { type StudioLocation } from "./studios";
import { SelectedEntityType, type SelectedEntity } from "./contract";
import { transformDirection, transformPoint, type Vec3 } from "./geometry";
import {
    type AssemblyCircle,
    type AssemblyHole,
    type PlacedScrew
} from "./planner";
import {
    type ScannedCircle,
    type ScannedHole,
    type StudioSelection,
    type StudioSource
} from "./scan";

export interface PartOccurrence {
    path: string[];
    transform: number[];
    partId: string;
    documentId: string;
    elementId: string;
    isStandardContent: boolean;
    source: StudioSource;
}

/** A tab's microversions in the assembly's own workspace, by element id. */
export type ElementMicroversions = Map<string, string>;

function subassemblyKey(instance: {
    documentId?: string;
    elementId?: string;
    configuration?: string;
    fullConfiguration?: string;
    documentMicroversion?: string;
}): string {
    return [
        instance.documentId,
        instance.elementId,
        instance.fullConfiguration ?? instance.configuration ?? "",
        instance.documentMicroversion
    ].join("|");
}

/** Whether a part comes from the assembly's own workspace, and so is pinned by its tab's microversion. */
export function isLocal(
    instance: OnshapeAssemblyInstance,
    assembly: ElementPath
): boolean {
    return (
        instance.documentVersion === undefined &&
        instance.documentId === assembly.documentId &&
        assembly.instanceType === "w"
    );
}

/** The Part Studio edit a part instance is from. */
export function toStudioSource(
    instance: OnshapeAssemblyInstance,
    assembly: ElementPath,
    microversions: ElementMicroversions
): StudioSource | undefined {
    const { documentId, elementId } = instance;
    if (!documentId || !elementId) {
        return undefined;
    }
    const configuration = instance.configuration || undefined;
    const pinnedConfiguration =
        instance.fullConfiguration ?? instance.configuration ?? "";
    if (instance.documentVersion) {
        return {
            path: {
                documentId,
                instanceType: "v",
                instanceId: instance.documentVersion,
                elementId
            },
            configuration,
            key: `${documentId}|v|${instance.documentVersion}|${elementId}|${pinnedConfiguration}`
        };
    }
    if (isLocal(instance, assembly)) {
        const microversion = microversions.get(elementId);
        if (!microversion) {
            return undefined;
        }
        return {
            path: { ...assembly, elementId },
            configuration,
            elementMicroversionId: microversion,
            key: `${documentId}|e|${microversion}|${elementId}|${pinnedConfiguration}`
        };
    }
    if (!instance.documentMicroversion) {
        return undefined;
    }
    return {
        path: {
            documentId,
            instanceType: "m",
            instanceId: instance.documentMicroversion,
            elementId
        },
        configuration,
        key: `${documentId}|m|${instance.documentMicroversion}|${elementId}|${pinnedConfiguration}`
    };
}

/** Every part occurrence, through subassemblies, with the edit it's from. */
export function partOccurrences(
    definition: OnshapeAssemblyDefinition,
    assembly: ElementPath,
    microversions: ElementMicroversions
): PartOccurrence[] {
    const subassemblies = new Map(
        definition.subAssemblies.map((sub) => [
            subassemblyKey(sub),
            sub.instances ?? []
        ])
    );
    const occurrences: PartOccurrence[] = [];
    for (const occurrence of definition.rootAssembly.occurrences ?? []) {
        let instances = definition.rootAssembly.instances;
        let instance: OnshapeAssemblyInstance | undefined;
        for (const [index, id] of occurrence.path.entries()) {
            instance = instances.find((each) => each.id === id);
            if (!instance || index === occurrence.path.length - 1) {
                break;
            }
            instances = subassemblies.get(subassemblyKey(instance)) ?? [];
        }
        if (instance?.type !== "Part" || !instance.partId) {
            continue;
        }
        const source = toStudioSource(instance, assembly, microversions);
        if (!source) {
            continue;
        }
        occurrences.push({
            path: occurrence.path,
            transform: occurrence.transform,
            partId: instance.partId,
            documentId: instance.documentId ?? "",
            elementId: instance.elementId ?? "",
            isStandardContent: instance.isStandardContent ?? false,
            source
        });
    }
    return occurrences;
}

export function pathKey(path: string[]): string {
    return path.join("/");
}

/** Whether an occurrence is one of Quick fastener's own parts, from any release of a studio. */
export function isFromStudio(
    occurrence: PartOccurrence,
    location: StudioLocation | undefined
): boolean {
    return (
        location !== undefined &&
        occurrence.documentId === location.documentId &&
        occurrence.elementId === location.elementId
    );
}

/** The screws already placed: each one's origin and axis in the assembly. */
export function placedScrews(
    occurrences: PartOccurrence[],
    screwStudio: StudioLocation | undefined
): PlacedScrew[] {
    return occurrences
        .filter((occurrence) => isFromStudio(occurrence, screwStudio))
        .map((occurrence) => ({
            origin: transformPoint(occurrence.transform, [0, 0, 0]),
            axis: transformDirection(occurrence.transform, [0, 0, 1])
        }));
}

/** What's picked in each studio, by its source's key. */
export function selectionsByStudio(
    entities: SelectedEntity[],
    occurrences: Map<string, PartOccurrence>
): Map<string, StudioSelection> {
    const selections = new Map<string, StudioSelection>();
    for (const entity of entities) {
        const occurrence = occurrences.get(pathKey(entity.occurrencePath));
        if (!occurrence) {
            continue;
        }
        const selection = selections.get(occurrence.source.key) ?? {
            edges: [],
            faces: []
        };
        const ids =
            entity.entityType === SelectedEntityType.EDGE
                ? selection.edges
                : selection.faces;
        if (!ids.includes(entity.entityId)) {
            ids.push(entity.entityId);
        }
        selections.set(occurrence.source.key, selection);
    }
    return selections;
}

/**
 * The circles a studio's scan found for the entities picked in it, one per
 * occurrence each was picked in, moved into the assembly.
 */
export function toAssemblyCircles(
    scanned: ScannedCircle[],
    entities: SelectedEntity[],
    occurrences: Map<string, PartOccurrence>
): AssemblyCircle[] {
    const circles: AssemblyCircle[] = [];
    for (const entity of entities) {
        const occurrence = occurrences.get(pathKey(entity.occurrencePath));
        if (!occurrence) {
            continue;
        }
        const matching = scanned.filter((circle) =>
            entity.entityType === SelectedEntityType.EDGE
                ? circle.id === entity.entityId && circle.faceId === undefined
                : circle.faceId === entity.entityId
        );
        for (const circle of matching) {
            if (circle.partId !== occurrence.partId) {
                continue;
            }
            circles.push({
                key: `${pathKey(occurrence.path)}|${circle.id}`,
                occurrencePath: occurrence.path,
                edgeId: circle.id,
                center: transformPoint(occurrence.transform, circle.center),
                normal: transformDirection(occurrence.transform, circle.normal),
                radius: circle.radius
            });
        }
    }
    return circles;
}

/** A part's holes, moved into the assembly. */
export function toAssemblyHoles(
    holes: ScannedHole[],
    occurrence: PartOccurrence
): AssemblyHole[] {
    return holes.map((hole) => {
        const origin: Vec3 = transformPoint(occurrence.transform, hole.origin);
        return {
            occurrencePath: occurrence.path,
            origin,
            direction: transformDirection(occurrence.transform, hole.direction),
            radius: hole.radius,
            start: hole.start,
            end: hole.end,
            closedAtStart: hole.closedAtStart,
            closedAtEnd: hole.closedAtEnd,
            threaded: hole.threaded,
            ...(hole.majorDiameter !== undefined
                ? { majorDiameter: hole.majorDiameter }
                : {}),
            edges: hole.edges
        };
    });
}

/** Circles, less those keyed in `excluded`, each once. */
export function withoutExcluded(
    circles: AssemblyCircle[],
    excluded: AssemblyCircle[]
): AssemblyCircle[] {
    const left = new Set(excluded.map((circle) => circle.key));
    const seen = new Set<string>();
    return circles.filter((circle) => {
        if (left.has(circle.key) || seen.has(circle.key)) {
            return false;
        }
        seen.add(circle.key);
        return true;
    });
}
