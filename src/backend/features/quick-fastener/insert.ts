/**
 * Puts each planned hole's parts into the assembly: all of them in one insert,
 * each placed where it goes, then one fasten mate per part, from its mate
 * connector to the hole's edge it sits on.
 */
import { HttpStatus } from "http-status-ts";
import { handledError } from "../../lib/api-error";
import { kvStore } from "../../lib/kv-store";
import { type OnshapeApi } from "../../lib/onshape/client";
import {
    addAssemblyFeature,
    getAssembly,
    insertTransformedInstances
} from "../../lib/onshape/endpoints/assemblies";
import { PartType } from "../../lib/onshape/endpoints/documents";
import {
    edgeCenterQuery,
    fastenMate,
    partStudioMateConnectorQuery
} from "../../lib/onshape/objects/assembly-features";
import { type ElementPath } from "../../lib/onshape/path";
import { encodeConfiguration } from "../configurations/utils";
import {
    catalog,
    FastenerKind,
    type FastenerConfiguration,
    getSeatWasher,
    nutConfiguration,
    screwConfiguration,
    type StudioLocation,
    washerConfiguration
} from "./catalog";
import { HoleStatus } from "./contract";
import { add, frameTransform, scale, type Vec3 } from "./geometry";
import { type HolePlan, type MateEdge } from "./planner";

/** One part to insert: from which studio, configured how, placed where, and fastened to which edge. */
export interface PartPlacement {
    kind: FastenerKind;
    configuration: FastenerConfiguration;
    transform: number[];
    edge: MateEdge;
    name: string;
}

/** A released studio's mate connector, by its version: a version's never changes. */
const mateConnectorIds = kvStore<string>("quick-fastener-mate-connector");

function seatThickness(vendor: string, size: string, washer: boolean): number {
    return washer ? (getSeatWasher(vendor, size)?.thickness ?? 0) : 0;
}

/**
 * Where every part of each ready hole goes. A screw and the washer under it
 * sit on the circle, pointing out of the part; a nut and its washer on the far
 * side, pointing the other way. A seated part's mate connector is below its
 * origin by its washer, so its origin is above the edge by as much.
 */
export function placements(plans: HolePlan[]): PartPlacement[] {
    return plans.flatMap((plan) => {
        const { planned, circle, exit } = plan;
        if (planned.status !== HoleStatus.READY || !planned.screw) {
            return [];
        }
        const out = circle.normal;
        const seated = (point: Vec3, zAxis: Vec3, thickness: number) =>
            frameTransform(add(point, scale(zAxis, thickness)), zAxis);
        const entry: MateEdge = {
            occurrencePath: circle.occurrencePath,
            edgeId: circle.edgeId
        };
        const { screw } = planned;
        const parts: PartPlacement[] = [
            {
                kind: FastenerKind.SCREW,
                configuration: screwConfiguration(screw),
                transform: seated(
                    circle.center,
                    out,
                    seatThickness(screw.vendor, screw.size, screw.washer)
                ),
                edge: entry,
                name: "Quick fastener screw"
            }
        ];
        if (planned.headWasher) {
            parts.push({
                kind: FastenerKind.WASHER,
                configuration: washerConfiguration(planned.headWasher),
                transform: frameTransform(circle.center, out),
                edge: entry,
                name: "Quick fastener washer"
            });
        }
        if (planned.nut && exit) {
            const back = scale(out, -1);
            parts.push({
                kind: FastenerKind.NUT,
                configuration: nutConfiguration(planned.nut),
                transform: seated(
                    exit.point,
                    back,
                    seatThickness(
                        planned.nut.vendor,
                        planned.nut.size,
                        planned.nut.washer
                    )
                ),
                edge: exit.edge,
                name: "Quick fastener nut"
            });
            if (planned.nutWasher) {
                parts.push({
                    kind: FastenerKind.WASHER,
                    configuration: washerConfiguration(planned.nutWasher),
                    transform: frameTransform(exit.point, back),
                    edge: exit.edge,
                    name: "Quick fastener washer"
                });
            }
        }
        return parts;
    });
}

function studioLocation(kind: FastenerKind): StudioLocation {
    const location = catalog.studios[kind].location;
    if (!location) {
        throw handledError(
            "Quick fastener's parts aren't published yet.",
            HttpStatus.SERVICE_UNAVAILABLE
        );
    }
    return location;
}

function locationKey(location: StudioLocation): string {
    return `${location.documentId}|${location.versionId}|${location.elementId}`;
}

/** Each studio's mate connector, as the assembly names it; read from the assembly once per release. */
async function mateConnectorIdsFor(
    client: OnshapeApi,
    kv: KVNamespace,
    assembly: ElementPath,
    kinds: FastenerKind[]
): Promise<Map<FastenerKind, string>> {
    const ids = new Map<FastenerKind, string>();
    const missing: FastenerKind[] = [];
    for (const kind of kinds) {
        const cached = await mateConnectorIds.get(
            kv,
            locationKey(studioLocation(kind))
        );
        if (cached) {
            ids.set(kind, cached);
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
        const part = definition.parts.find(
            (each) =>
                each.documentId === location.documentId &&
                each.elementId === location.elementId &&
                each.documentVersion === location.versionId &&
                (each.mateConnectors?.length ?? 0) > 0
        );
        const id = part?.mateConnectors?.[0]?.featureId;
        if (!id) {
            throw handledError(
                "The inserted fastener has no mate connector to fasten.",
                HttpStatus.BAD_GATEWAY
            );
        }
        await mateConnectorIds.put(kv, locationKey(location), id);
        ids.set(kind, id);
    }
    return ids;
}

/** Inserts and fastens every ready hole's parts; returns how many parts went in. */
export async function insertFasteners(
    client: OnshapeApi,
    kv: KVNamespace,
    assembly: ElementPath,
    plans: HolePlan[]
): Promise<number> {
    const parts = placements(plans);
    if (parts.length === 0) {
        return 0;
    }
    const response = await insertTransformedInstances(
        client,
        assembly,
        parts.map((part) => {
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
        })
    );
    const paths = (response.insertInstanceResponses ?? []).map(
        (each) => each.occurrences?.[0]?.path
    );

    const kinds = [...new Set(parts.map((part) => part.kind))];
    const connectors = await mateConnectorIdsFor(client, kv, assembly, kinds);
    // One at a time: each mate changes the assembly the next is added to
    for (const [index, part] of parts.entries()) {
        const path = paths[index];
        const connector = connectors.get(part.kind);
        if (!path || !connector) {
            continue;
        }
        await addAssemblyFeature(
            client,
            assembly,
            fastenMate(part.name, [
                partStudioMateConnectorQuery(connector, path),
                edgeCenterQuery(part.edge.occurrencePath, part.edge.edgeId)
            ])
        );
    }
    return parts.length;
}
