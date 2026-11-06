/**
 * Screws picked to replace: the hole edge each sits on, which is planned again
 * as if picked, the washers and nuts on its axis, which go with it, and the
 * mates left referencing them once they're deleted. Pure.
 */
import { type OnshapeListedFeature } from "../../lib/onshape/types";
import { decodeConfiguration } from "../configurations/utils";
import {
    type PartOccurrence,
    isFromStudio,
    pathKey,
    placedScrew
} from "./assembly";
import {
    distanceToLine,
    dot,
    isParallel,
    LINEAR_TOLERANCE,
    normalize,
    add,
    scale,
    subtract,
    type Vec3
} from "./geometry";
import {
    type AssemblyCircularEdge,
    type AssemblyHole,
    type PlacedScrew
} from "./planner";
import { FastenerKind, type FastenerSet, StudioInput } from "./studios";

/** A screw's stack, to delete once its hole has a new plan. */
export interface Replacement {
    /** The hole's circular edge, as its plan is keyed. */
    key: string;
    /** The screw's and its washers' and nuts' instances, by node id. */
    instanceIds: string[];
}

/**
 * The hole edge a screw sits on: on its axis, at its head or a washer's
 * thickness under it, with the hole going on below.
 */
export function seatEdge(
    screw: PlacedScrew,
    holes: AssemblyHole[],
    maxWasherThickness: number
): AssemblyCircularEdge | undefined {
    const axis = normalize(screw.axis);
    let best: { edge: AssemblyCircularEdge; under: number } | undefined;
    for (const hole of holes) {
        if (
            !isParallel(hole.direction, axis) ||
            distanceToLine(screw.origin, hole.origin, hole.direction) >=
                LINEAR_TOLERANCE
        ) {
            continue;
        }
        const point = (along: number): Vec3 =>
            add(hole.origin, scale(hole.direction, along));
        const deepest = Math.min(
            dot(subtract(point(hole.start), screw.origin), axis),
            dot(subtract(point(hole.end), screw.origin), axis)
        );
        for (const edge of hole.edges) {
            const center = point(edge.at);
            const under = dot(subtract(screw.origin, center), axis);
            const isSeat =
                under >= -LINEAR_TOLERANCE &&
                under <= maxWasherThickness + LINEAR_TOLERANCE &&
                deepest < -under - LINEAR_TOLERANCE;
            if (isSeat && (!best || under < best.under)) {
                best = {
                    under,
                    edge: {
                        key: `${pathKey(hole.occurrencePath)}|${edge.id}`,
                        occurrencePath: hole.occurrencePath,
                        edgeId: edge.id,
                        center,
                        normal: axis,
                        radius: hole.radius
                    }
                };
            }
        }
    }
    return best?.edge;
}

/** A screw's length in metres, from its configuration, or its studio's default length. */
export function screwLength(
    set: FastenerSet,
    occurrence: PartOccurrence
): number | undefined {
    const parameter = set.studios[FastenerKind.SCREW].parameters.find(
        (each) => each.id === StudioInput.LENGTH
    );
    const lengthId =
        decodeConfiguration(occurrence.source.configuration ?? "")[
            StudioInput.LENGTH
        ] ?? parameter?.default;
    return set.catalog.screws
        .flatMap((screw) => screw.lengths)
        .find((length) => length.id === lengthId)?.length;
}

/** The washers and nuts on a screw's axis, from under its head to its tip. */
export function stackParts(
    screw: PartOccurrence,
    length: number,
    occurrences: PartOccurrence[],
    set: FastenerSet
): PartOccurrence[] {
    const { origin, axis } = placedScrew(screw);
    const unit = normalize(axis);
    const kinds = [FastenerKind.WASHER, FastenerKind.NUT];
    return occurrences.filter((occurrence) => {
        if (
            !kinds.some((kind) =>
                isFromStudio(occurrence, set.studios[kind].location)
            )
        ) {
            return false;
        }
        const part = placedScrew(occurrence);
        const below = dot(subtract(origin, part.origin), unit);
        return (
            isParallel(part.axis, unit) &&
            distanceToLine(part.origin, origin, unit) < LINEAR_TOLERANCE &&
            below >= -LINEAR_TOLERANCE &&
            below <= length + LINEAR_TOLERANCE
        );
    });
}

/** Every query path anywhere in a feature, as its references name instances. */
function queryPaths(value: unknown): string[][] {
    if (Array.isArray(value)) {
        return value.flatMap(queryPaths);
    }
    if (typeof value !== "object" || value === null) {
        return [];
    }
    return Object.entries(value).flatMap(([key, each]) =>
        key === "path" &&
        Array.isArray(each) &&
        each.every((id) => typeof id === "string")
            ? [each]
            : queryPaths(each)
    );
}

/** The mates referencing any of the deleted instances, which nothing can solve any more. */
export function orphanedMates(
    features: OnshapeListedFeature[],
    deletedIds: string[]
): string[] {
    const deleted = new Set(deletedIds);
    return features
        .filter(
            (feature) =>
                feature.featureType === "mate" &&
                queryPaths(feature).some(
                    (path) => path.length > 0 && deleted.has(path[0])
                )
        )
        .map((feature) => feature.featureId);
}
