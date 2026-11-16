/**
 * Putting planned holes' parts into the assembly: where each goes, what it's
 * fastened to, and the Onshape bodies that insert and fasten it. A washer is
 * fastened to the hole's edge and its screw or nut to the washer's top
 * connector, so any washer fits.
 */
import { PartType } from "../../lib/onshape/endpoints/documents";
import {
    fastenMate,
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
import { type PreviewPart } from "../previews/contract";
import { type Catalog, getWasher } from "./catalog";
import { HoleStatus, RunPartRole } from "./contract";
import { add, frameTransform, scale, type Vec3 } from "./geometry";
import { type HolePlan, type MateEdge } from "./planner";
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
    role: RunPartRole;
    /** The planned hole's key, which a run reports its parts under. */
    hole: string;
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
                role: RunPartRole.SCREW_WASHER,
                hole: planned.key,
                configuration: studioConfiguration(
                    set,
                    FastenerKind.WASHER,
                    planned.screwWasher
                ),
                transform: frameTransform(circularEdge.center, out),
                seat: { edge: entry },
                name: "Auto Assembly washer"
            });
        }
        parts.push({
            kind: FastenerKind.SCREW,
            role: RunPartRole.SCREW,
            hole: planned.key,
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
            name: "Auto Assembly screw"
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
                role: RunPartRole.NUT_WASHER,
                hole: planned.key,
                configuration: studioConfiguration(
                    set,
                    FastenerKind.WASHER,
                    planned.nutWasher
                ),
                transform: frameTransform(exit.point, back),
                seat: { edge: exit.edge },
                name: "Auto Assembly washer"
            });
        }
        const nutAt: Vec3 = add(
            exit.point,
            scale(back, thickness(set.catalog, planned.nutWasher))
        );
        parts.push({
            kind: FastenerKind.NUT,
            role: RunPartRole.NUT,
            hole: planned.key,
            configuration: studioConfiguration(
                set,
                FastenerKind.NUT,
                planned.nut
            ),
            transform: frameTransform(nutAt, back),
            seat: nutSeat,
            name: "Auto Assembly nut"
        });
    }
    return parts;
}

/** Each part as the preview extension draws it, from its studio's loaded version. */
export function previewParts(
    set: FastenerSet,
    parts: PartPlacement[]
): PreviewPart[] {
    return parts.map((part) => {
        const studio = set.studios[part.kind];
        return {
            insertableId: studio.insertableId,
            microversionId: studio.microversionId,
            configuration: encodeConfiguration(part.configuration),
            transform: part.transform
        };
    });
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

/**
 * The fasten mate holding one inserted part where it sits: on a hole's edge,
 * or a washer's top connector. Undefined when the washer wasn't inserted.
 */
export function partMate(
    part: PartPlacement,
    path: string[],
    connectorId: string,
    paths: (string[] | undefined)[],
    washerTopConnectorId: string
): object | undefined {
    const own = partStudioMateConnectorQuery(connectorId, path);
    if ("edge" in part.seat) {
        return fastenMateToCircularEdge(part.name, own, {
            deterministicId: part.seat.edge.edgeId,
            path: part.seat.edge.occurrencePath
        });
    }
    const washerPath = paths[part.seat.washer];
    if (!washerPath) {
        return undefined;
    }
    return fastenMate(part.name, [
        own,
        partStudioMateConnectorQuery(washerTopConnectorId, washerPath)
    ]);
}
