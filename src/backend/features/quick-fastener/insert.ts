/**
 * Putting planned holes' parts into the assembly: where each goes, what it's
 * fastened to, and the Onshape bodies that insert and fasten it. A washer is
 * fastened to the hole's edge and its screw or nut to the washer's top edge,
 * so any washer fits.
 */
import { type OnshapeApi } from "../../lib/onshape/client";
import { PartType } from "../../lib/onshape/endpoints/documents";
import {
    type EdgeReference,
    fastenMateToCircularEdge,
    partStudioMateConnectorQuery
} from "../../lib/onshape/objects/assembly-features";
import { type Db } from "../../db/client";
import { type Selection } from "../configurations/contract";
import { toSelection } from "../configurations/selection";
import {
    partName,
    readStoredParts,
    type StoredParts
} from "../library/insertables/part-name";
import { encodeConfiguration } from "../configurations/utils";
import { type Catalog, getWasher } from "./catalog";
import { HoleStatus } from "./contract";
import { add, frameTransform, scale, type Vec3 } from "./geometry";
import { type HolePlan, type MateEdge } from "./planner";
import { scanStudio, type ScannedParts, type StudioSource } from "./scan";
import {
    FastenerKind,
    type FastenerSet,
    type PartChoice,
    studioConfiguration
} from "./studios";

/** What a part is fastened to: an edge in the assembly, or the top of a washer placed with it. */
export type PartSeat = { edge: MateEdge } | { washer: number };

/** One part to insert: from which studio, configured how, placed where, and fastened to what. */
export interface PartPlacement {
    kind: FastenerKind;
    /** The studio's overrides of its defaults. */
    configuration: Selection;
    transform: number[];
    seat: PartSeat;
    name: string;
}

function thickness(catalog: Catalog, washer: PartChoice | undefined): number {
    return washer
        ? (getWasher(catalog, washer.vendor, washer.size, washer.type)
              ?.thickness ?? 0)
        : 0;
}

/** Each part named as its studio's records name its configuration, which its mates take. */
export async function namePlacements(
    db: Db,
    set: FastenerSet,
    parts: PartPlacement[]
): Promise<PartPlacement[]> {
    const stored = new Map<FastenerKind, StoredParts | undefined>();
    for (const kind of new Set(parts.map((part) => part.kind))) {
        stored.set(
            kind,
            await readStoredParts(db, set.studios[kind].insertableId)
        );
    }
    return parts.map((part) => {
        const studio = stored.get(part.kind);
        return studio
            ? {
                  ...part,
                  name: partName(
                      studio,
                      toSelection(part.configuration, studio.parameters)
                  )
              }
            : part;
    });
}

/**
 * Where every part of each ready hole goes. A screw and the washer under it
 * sit on the circular edge, pointing out of the part; a nut and its washer on the far
 * side, pointing the other way, each part on top of the one under it.
 */
export function placements(
    set: FastenerSet,
    plans: HolePlan[]
): PartPlacement[] {
    const parts: PartPlacement[] = [];
    for (const { planned, circularEdge, exit } of plans) {
        if (planned.status !== HoleStatus.READY || !planned.screw) {
            continue;
        }
        const out = circularEdge.normal;
        const entry: MateEdge = {
            occurrencePath: circularEdge.occurrencePath,
            edgeId: circularEdge.edgeId
        };
        let screwSeat: PartSeat = { edge: entry };
        if (planned.screwWasher) {
            screwSeat = { washer: parts.length };
            parts.push({
                kind: FastenerKind.WASHER,
                configuration: studioConfiguration(
                    set,
                    FastenerKind.WASHER,
                    planned.screwWasher
                ),
                transform: frameTransform(circularEdge.center, out),
                seat: { edge: entry },
                name: "Quick fastener washer"
            });
        }
        parts.push({
            kind: FastenerKind.SCREW,
            configuration: studioConfiguration(
                set,
                FastenerKind.SCREW,
                planned.screw
            ),
            transform: frameTransform(
                add(
                    circularEdge.center,
                    scale(out, thickness(set.catalog, planned.screwWasher))
                ),
                out
            ),
            seat: screwSeat,
            name: "Quick fastener screw"
        });
        if (!planned.nut || !exit) {
            continue;
        }
        const back = scale(out, -1);
        let nutSeat: PartSeat = { edge: exit.edge };
        if (planned.nutWasher) {
            nutSeat = { washer: parts.length };
            parts.push({
                kind: FastenerKind.WASHER,
                configuration: studioConfiguration(
                    set,
                    FastenerKind.WASHER,
                    planned.nutWasher
                ),
                transform: frameTransform(exit.point, back),
                seat: { edge: exit.edge },
                name: "Quick fastener washer"
            });
        }
        const nutAt: Vec3 = add(
            exit.point,
            scale(back, thickness(set.catalog, planned.nutWasher))
        );
        parts.push({
            kind: FastenerKind.NUT,
            configuration: studioConfiguration(
                set,
                FastenerKind.NUT,
                planned.nut
            ),
            transform: frameTransform(nutAt, back),
            seat: nutSeat,
            name: "Quick fastener nut"
        });
    }
    return parts;
}

/** `transformedinstances`' groups: one per part, each landed where it goes. */
export function insertGroups(
    set: FastenerSet,
    parts: PartPlacement[]
): { instances: object[]; transform: number[] }[] {
    return parts.map((part) => {
        const { location } = set.studios[part.kind];
        return {
            instances: [
                {
                    documentId: location.documentId,
                    versionId: location.versionId,
                    elementId: location.elementId,
                    configuration: encodeConfiguration(part.configuration),
                    isWholePartStudio: true,
                    includePartTypes: [PartType.PARTS]
                }
            ],
            transform: part.transform
        };
    });
}

/** The washer studio at its release, in one configuration: what its top edge is read from. */
export function washerSource(
    set: FastenerSet,
    configuration: Selection
): StudioSource {
    const { location } = set.studios[FastenerKind.WASHER];
    const encoded = encodeConfiguration(configuration);
    return {
        path: {
            documentId: location.documentId,
            instanceType: "v",
            instanceId: location.versionId,
            elementId: location.elementId
        },
        configuration: encoded,
        key: `${location.documentId}|v|${location.versionId}|${location.elementId}|${encoded}`
    };
}

/** A washer's top edge: the circular edge of its hole farthest up its Z axis, where what sits on it seats. */
export function washerTopEdge(parts: ScannedParts): string | undefined {
    const edges = Object.values(parts).flatMap((part) =>
        part.holes.flatMap((hole) =>
            hole.edges.map((edge) => ({
                id: edge.id,
                z: hole.origin[2] + hole.direction[2] * edge.at
            }))
        )
    );
    return edges.sort((a, b) => b.z - a.z)[0]?.id;
}

/** Each placed washer's top edge, by its index in the placements; one scan per configuration, cached. */
export async function washerTopEdges(
    client: OnshapeApi,
    kv: KVNamespace,
    set: FastenerSet,
    parts: PartPlacement[]
): Promise<Record<number, string>> {
    const byConfiguration = new Map<string, string | undefined>();
    const edges: Record<number, string> = {};
    for (const [index, part] of parts.entries()) {
        if (part.kind !== FastenerKind.WASHER) {
            continue;
        }
        const source = washerSource(set, part.configuration);
        if (!byConfiguration.has(source.key)) {
            const scan = await scanStudio(client, kv, source, {
                edges: [],
                faces: []
            });
            byConfiguration.set(source.key, washerTopEdge(scan.parts));
        }
        const edge = byConfiguration.get(source.key);
        if (edge) {
            edges[index] = edge;
        }
    }
    return edges;
}

/** The fasten mate holding one inserted part where it sits; undefined when what it sits on can't be named. */
export function partMate(
    part: PartPlacement,
    path: string[],
    connectorId: string,
    paths: (string[] | undefined)[],
    washerEdges: Record<number, string>
): object | undefined {
    let seat: EdgeReference;
    if ("edge" in part.seat) {
        seat = {
            deterministicId: part.seat.edge.edgeId,
            path: part.seat.edge.occurrencePath
        };
    } else {
        const washerPath = paths[part.seat.washer];
        const edge = washerEdges[part.seat.washer];
        if (!washerPath || !edge) {
            return undefined;
        }
        seat = { deterministicId: edge, path: washerPath };
    }
    return fastenMateToCircularEdge(
        part.name,
        partStudioMateConnectorQuery(connectorId, path),
        seat
    );
}
