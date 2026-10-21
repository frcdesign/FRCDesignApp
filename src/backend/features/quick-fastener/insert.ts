/**
 * Putting planned holes' parts into the assembly: where each goes, what it's
 * fastened to, and the Onshape bodies that insert and fasten it. A screw or
 * nut on a washer is fastened to the washer's top edge, so any washer fits;
 * anything else to the hole's own edge.
 */
import { HttpStatus } from "http-status-ts";
import { handledError } from "../../lib/api-error";
import { kvStore } from "../../lib/kv-store";
import { type OnshapeApi } from "../../lib/onshape/client";
import { getAssembly } from "../../lib/onshape/endpoints/assemblies";
import { PartType } from "../../lib/onshape/endpoints/documents";
import {
    edgeCenterQuery,
    fastenMate,
    partStudioMateConnectorQuery
} from "../../lib/onshape/objects/assembly-features";
import { type ElementPath } from "../../lib/onshape/path";
import { type Selection } from "../configurations/contract";
import { encodeConfiguration } from "../configurations/utils";
import { getWasher } from "./catalog";
import { HoleStatus } from "./contract";
import { add, frameTransform, scale, type Vec3 } from "./geometry";
import { type HolePlan, type MateEdge } from "./planner";
import { scanStudio, type ScannedParts, type StudioSource } from "./scan";
import {
    FastenerKind,
    getStudioLocation,
    type PartChoice,
    studioConfiguration,
    type StudioLocation
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

/** A released studio's mate connector, by its version: a version's never changes. */
const mateConnectorIds = kvStore<string>("quick-fastener-mate-connector");

function thickness(washer: PartChoice | undefined): number {
    return washer
        ? (getWasher(washer.vendor, washer.size, washer.type)?.thickness ?? 0)
        : 0;
}

/**
 * Where every part of each ready hole goes. A screw and the washer under it
 * sit on the circle, pointing out of the part; a nut and its washer on the far
 * side, pointing the other way, each part on top of the one under it.
 */
export function placements(plans: HolePlan[]): PartPlacement[] {
    const parts: PartPlacement[] = [];
    for (const { planned, circle, exit } of plans) {
        if (planned.status !== HoleStatus.READY || !planned.screw) {
            continue;
        }
        const out = circle.normal;
        const entry: MateEdge = {
            occurrencePath: circle.occurrencePath,
            edgeId: circle.edgeId
        };
        let screwSeat: PartSeat = { edge: entry };
        if (planned.screwWasher) {
            screwSeat = { washer: parts.length };
            parts.push({
                kind: FastenerKind.WASHER,
                configuration: studioConfiguration(
                    FastenerKind.WASHER,
                    planned.screwWasher
                ),
                transform: frameTransform(circle.center, out),
                seat: { edge: entry },
                name: "Quick fastener washer"
            });
        }
        parts.push({
            kind: FastenerKind.SCREW,
            configuration: studioConfiguration(
                FastenerKind.SCREW,
                planned.screw
            ),
            transform: frameTransform(
                add(circle.center, scale(out, thickness(planned.screwWasher))),
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
            scale(back, thickness(planned.nutWasher))
        );
        parts.push({
            kind: FastenerKind.NUT,
            configuration: studioConfiguration(FastenerKind.NUT, planned.nut),
            transform: frameTransform(nutAt, back),
            seat: nutSeat,
            name: "Quick fastener nut"
        });
    }
    return parts;
}

export function studioLocation(kind: FastenerKind): StudioLocation {
    const location = getStudioLocation(kind);
    if (!location) {
        throw handledError(
            "Quick fastener's parts aren't published yet.",
            HttpStatus.SERVICE_UNAVAILABLE
        );
    }
    return location;
}

/** `transformedinstances`' groups: one per part, each landed where it goes. */
export function insertGroups(
    parts: PartPlacement[]
): { instances: object[]; transform: number[] }[] {
    return parts.map((part) => {
        const location = studioLocation(part.kind);
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

function locationKey(location: StudioLocation): string {
    return `${location.documentId}|${location.versionId}|${location.elementId}`;
}

/** Each studio's mate connector, as the assembly names it; read from the assembly once per release. */
export async function mateConnectorIdsFor(
    client: OnshapeApi,
    kv: KVNamespace,
    assembly: ElementPath,
    kinds: FastenerKind[]
): Promise<Partial<Record<FastenerKind, string>>> {
    const ids: Partial<Record<FastenerKind, string>> = {};
    const missing: FastenerKind[] = [];
    for (const kind of kinds) {
        const cached = await mateConnectorIds.get(
            kv,
            locationKey(studioLocation(kind))
        );
        if (cached) {
            ids[kind] = cached;
        } else {
            missing.push(kind);
        }
    }
    if (missing.length === 0) {
        return ids;
    }
    const definition = await getAssembly(client, assembly, {
        includeMateConnectors: true
    });
    for (const kind of missing) {
        const location = studioLocation(kind);
        const id = definition.parts.find(
            (each) =>
                each.documentId === location.documentId &&
                each.elementId === location.elementId &&
                each.documentVersion === location.versionId &&
                (each.mateConnectors?.length ?? 0) > 0
        )?.mateConnectors?.[0]?.featureId;
        if (!id) {
            throw handledError(
                "The inserted fastener has no mate connector to fasten.",
                HttpStatus.BAD_GATEWAY
            );
        }
        await mateConnectorIds.put(kv, locationKey(location), id);
        ids[kind] = id;
    }
    return ids;
}

/** The washer studio at its release, in one configuration: what its top edge is read from. */
export function washerSource(configuration: Selection): StudioSource {
    const location = studioLocation(FastenerKind.WASHER);
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

/** A washer's top edge: the circle of its hole farthest up its Z axis, where what sits on it seats. */
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
    parts: PartPlacement[]
): Promise<Record<number, string>> {
    const byConfiguration = new Map<string, string | undefined>();
    const edges: Record<number, string> = {};
    for (const [index, part] of parts.entries()) {
        if (part.kind !== FastenerKind.WASHER) {
            continue;
        }
        const source = washerSource(part.configuration);
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
    let seat: object;
    if ("edge" in part.seat) {
        seat = edgeCenterQuery(
            part.seat.edge.occurrencePath,
            part.seat.edge.edgeId
        );
    } else {
        const washerPath = paths[part.seat.washer];
        const edge = washerEdges[part.seat.washer];
        if (!washerPath || !edge) {
            return undefined;
        }
        seat = edgeCenterQuery(washerPath, edge);
    }
    return fastenMate(part.name, [
        partStudioMateConnectorQuery(connectorId, path),
        seat
    ]);
}
