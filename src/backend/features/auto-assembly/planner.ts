/**
 * Picks the fastener for each hole: pure, from the assembly's holes and the
 * circular edges picked, both in the assembly's coordinates.
 *
 * A hole is followed from its circular edge into the parts, through every hole on the
 * same axis, until it ends: in threads (tapped), at the bottom of a hole
 * (blind), or out the far side (through, where a nut goes). It stops past the
 * longest screw made, the maximum length, or the face to stop at, by the stop
 * condition. A screw goes no deeper into threads than the maximum thread depth.
 */
import {
    type Catalog,
    type CatalogSize,
    Program,
    getHead,
    getLengths,
    getNut,
    getSize,
    getWasher
} from "./catalog";
import {
    FastenerMode,
    type FastenerOptions,
    HoleEnd,
    HoleStatus,
    type PlannedHole,
    StopCondition
} from "./contract";
import { type PartChoice, type ScrewChoice } from "./studios";
import { type AssemblyPlane } from "./assembly";
import {
    add,
    distanceToLine,
    dot,
    isParallel,
    LINEAR_TOLERANCE,
    scale,
    type Vec3
} from "./geometry";

/** A hole in one part occurrence, from the hole scan, moved into the assembly. */
export interface AssemblyHole {
    occurrencePath: string[];
    origin: Vec3;
    /** Unit. */
    direction: Vec3;
    radius: number;
    /** Along `direction` from `origin`. */
    start: number;
    end: number;
    closedAtStart: boolean;
    closedAtEnd: boolean;
    threaded: boolean;
    majorDiameter?: number;
    edges: { id: string; at: number }[];
}

/** A circular edge picked to fasten, in the assembly. */
export interface AssemblyCircularEdge {
    key: string;
    occurrencePath: string[];
    edgeId: string;
    center: Vec3;
    /** Unit, out of the part: a fastener goes in against it. */
    normal: Vec3;
    radius: number;
}

/** A library screw already in the assembly, from Auto Assembly or not: its origin and Z axis. */
export interface PlacedScrew {
    origin: Vec3;
    axis: Vec3;
}

/** An edge a part is fastened to. */
export interface MateEdge {
    occurrencePath: string[];
    edgeId: string;
}

/** A hole's plan, with where its parts go. */
export interface HolePlan {
    planned: PlannedHole;
    circularEdge: AssemblyCircularEdge;
    /** Where the nut seats, out the far side, and the edge it's fastened to. */
    exit?: { point: Vec3; edge: MateEdge; radius: number };
}

/** A hole met along the axis, measured along it from the circular edge. */
interface Segment {
    hole: AssemblyHole;
    near: number;
    far: number;
    closedFar: boolean;
    /** Where each of its edges is along the axis. */
    edges: { id: string; t: number }[];
}

/** The run's options, with the catalog the parts come from, and the plane `StopCondition.FACE` stops at. */
interface PlanOptions extends FastenerOptions {
    catalog: Catalog;
    stopPlane?: AssemblyPlane;
}

const INCH = 0.0254;

/** A screw goes at least this many diameters into threads, or as far as they go. */
const MIN_ENGAGEMENT_DIAMETERS = 1;

/** How close a hole is to a size's tap drill to be taken for a tapped hole drawn without threads. */
const TAP_DRILL_RATIO = 0.03;

export function planHoles(
    circularEdges: AssemblyCircularEdge[],
    holes: AssemblyHole[],
    placed: PlacedScrew[],
    options: FastenerOptions,
    catalog: Catalog,
    stopPlane?: AssemblyPlane
): HolePlan[] {
    return circularEdges.map((circularEdge) =>
        planHole(circularEdge, holes, placed, {
            ...options,
            catalog,
            stopPlane
        })
    );
}

function planHole(
    circularEdge: AssemblyCircularEdge,
    holes: AssemblyHole[],
    placed: PlacedScrew[],
    options: PlanOptions
): HolePlan {
    const plan = (planned: Omit<PlannedHole, "key">): HolePlan => ({
        planned: { key: circularEdge.key, ...planned },
        circularEdge
    });
    const into = scale(circularEdge.normal, -1);

    const maxWasher = Math.max(
        ...options.catalog.washers.map((washer) => washer.thickness)
    );
    if (
        placed.some((screw) => isInHole(screw, circularEdge, into, maxWasher))
    ) {
        return plan({ status: HoleStatus.FASTENED });
    }

    const size = getSize(options.catalog, options.screw.size);
    const head = getHead(options.catalog, options.screw.head)?.sizes[
        options.screw.size
    ];
    if (!size || !head) {
        return plan({
            status: HoleStatus.NO_FIT,
            reason: "The head isn't made in this size."
        });
    }

    const segments = alongAxis(circularEdge, into, holes);
    // A flat head's countersink is above its first hole
    const allowance = head.countersunk ? head.height : 0;
    const first = segments.find(
        (segment) =>
            segment.near <= allowance + LINEAR_TOLERANCE &&
            segment.far > LINEAR_TOLERANCE
    );
    if (!first) {
        return plan({
            status: HoleStatus.NO_FIT,
            reason: "No hole goes into the part from this circular edge."
        });
    }
    if (2 * first.hole.radius < size.majorDiameter - LINEAR_TOLERANCE) {
        return plan({
            status: HoleStatus.NO_FIT,
            reason: `The hole is too small for a ${size.name} screw.`
        });
    }

    // Where the axis meets the face to stop at, along it from the circular edge
    let stopAt: number | undefined;
    if (options.stop === StopCondition.FACE) {
        stopAt =
            options.stopPlane &&
            meetsPlane(circularEdge, into, options.stopPlane);
        if (stopAt === undefined || stopAt <= LINEAR_TOLERANCE) {
            return plan({
                status: HoleStatus.NO_FIT,
                reason: options.stopPlane
                    ? "The face to stop at isn't past this hole along its axis."
                    : "Select a face to stop at."
            });
        }
    }
    const stack = followStack(segments, first, size, options, stopAt);
    const end = stack.end;
    const washers = chooseWashers(options, head.countersunk, end);
    const picked = pickScrew(options, size, stack, washers);
    if ("error" in picked) {
        return plan({ status: HoleStatus.NO_FIT, reason: picked.error, end });
    }
    const planned: Omit<PlannedHole, "key"> = {
        status: HoleStatus.READY,
        end,
        depth: stack.depth,
        screw: picked.screw,
        ...(picked.warning ? { warning: picked.warning } : {}),
        ...(washers.start ? { screwWasher: washers.start } : {})
    };

    const nut = nutChoice(options, end);
    if (!nut) {
        return plan(planned);
    }
    const exitEdge = stack.last.edges.find(
        (edge) => Math.abs(edge.t - stack.depth) < LINEAR_TOLERANCE
    );
    if (!exitEdge) {
        const noNut =
            "No edge on the far side to fasten a nut to, so it gets no nut.";
        return plan({
            ...planned,
            warning: planned.warning ? `${planned.warning} ${noNut}` : noNut
        });
    }
    return {
        planned: {
            key: circularEdge.key,
            ...planned,
            nut,
            ...(washers.end ? { nutWasher: washers.end } : {})
        },
        circularEdge,
        exit: {
            point: add(circularEdge.center, scale(into, stack.depth)),
            edge: {
                occurrencePath: stack.last.hole.occurrencePath,
                edgeId: exitEdge.id
            },
            radius: stack.last.hole.radius
        }
    };
}

function isInHole(
    screw: PlacedScrew,
    circularEdge: AssemblyCircularEdge,
    into: Vec3,
    maxWasherThickness: number
): boolean {
    return (
        isParallel(screw.axis, into) &&
        distanceToLine(screw.origin, circularEdge.center, into) <
            LINEAR_TOLERANCE &&
        // At the circular edge, or seated on a washer above it
        Math.abs(dot(screw.origin, into) - dot(circularEdge.center, into)) <=
            maxWasherThickness + LINEAR_TOLERANCE
    );
}

/** Every hole on the circular edge's axis, as it lies along it, nearest first. */
function alongAxis(
    circularEdge: AssemblyCircularEdge,
    into: Vec3,
    holes: AssemblyHole[]
): Segment[] {
    const t = (point: Vec3) =>
        dot(point, into) - dot(circularEdge.center, into);
    const segments: Segment[] = [];
    for (const hole of holes) {
        if (
            !isParallel(hole.direction, into) ||
            distanceToLine(circularEdge.center, hole.origin, hole.direction) >=
                LINEAR_TOLERANCE
        ) {
            continue;
        }
        const at = (along: number) =>
            t(add(hole.origin, scale(hole.direction, along)));
        const startT = at(hole.start);
        const endT = at(hole.end);
        const forward = startT <= endT;
        segments.push({
            hole,
            near: Math.min(startT, endT),
            far: Math.max(startT, endT),
            closedFar: forward ? hole.closedAtEnd : hole.closedAtStart,
            edges: hole.edges.map((edge) => ({ id: edge.id, t: at(edge.at) }))
        });
    }
    return segments.sort((a, b) => a.near - b.near);
}

/** Whether a hole is tapped for a size: a Hole feature's threads, or a hole drawn at its tap drill. */
function isTappedFor(segment: Segment, size: CatalogSize): boolean {
    if (segment.hole.threaded && segment.hole.majorDiameter !== undefined) {
        return (
            Math.abs(segment.hole.majorDiameter - size.majorDiameter) <
            LINEAR_TOLERANCE
        );
    }
    return (
        Math.abs(2 * segment.hole.radius - size.tapDrillDiameter) <=
        size.tapDrillDiameter * TAP_DRILL_RATIO
    );
}

/** The longest screw the vendor makes in the size and head: the farthest any stack is followed. */
function longestLength(options: PlanOptions): number {
    const { vendor, size, head } = options.screw;
    const lengths = getLengths(
        options.catalog,
        vendor,
        size,
        head,
        options.screw.finish
    );
    return lengths.length > 0 ? lengths[lengths.length - 1].length : 0;
}

/** How far along the axis from the circular edge it meets the plane; none when it runs along it. */
function meetsPlane(
    circularEdge: AssemblyCircularEdge,
    into: Vec3,
    plane: AssemblyPlane
): number | undefined {
    const along = dot(into, plane.normal);
    if (Math.abs(along) < 1e-9) {
        return undefined;
    }
    return (
        (dot(plane.point, plane.normal) -
            dot(circularEdge.center, plane.normal)) /
        along
    );
}

/** The longest an automatic screw may be, when its stop condition limits it. */
function lengthLimit(options: PlanOptions): number | undefined {
    return options.stop === StopCondition.MAX_LENGTH
        ? options.maxLength
        : undefined;
}

/** The deepest a stack is followed: to the face to stop at, if any, and no farther than the longest screw allowed. */
function stopReach(options: PlanOptions, stopAt: number | undefined): number {
    const longest = lengthLimit(options) ?? longestLength(options);
    return stopAt === undefined ? longest : Math.min(stopAt, longest);
}

interface Stack {
    end: HoleEnd;
    /** From the circular edge to where it ends: the far side, or the bottom of the hole. */
    depth: number;
    /** Where threads (or the blind hole the screw ends in) start. */
    engagementStart: number;
    last: Segment;
}

/** Follows the holes from the first until the stack ends. */
function followStack(
    segments: Segment[],
    first: Segment,
    size: CatalogSize,
    options: PlanOptions,
    stopAt: number | undefined
): Stack {
    const limit = stopReach(options, stopAt);
    let reach = first.far;
    let last = first;
    if (first.closedFar) {
        return {
            end: HoleEnd.BLIND,
            depth: first.far,
            engagementStart: 0,
            last
        };
    }
    for (const segment of segments) {
        if (segment === first || segment.far <= reach + LINEAR_TOLERANCE) {
            continue;
        }
        if (segment.near > limit - LINEAR_TOLERANCE) {
            break;
        }
        const isThreaded =
            2 * segment.hole.radius < size.majorDiameter &&
            isTappedFor(segment, size);
        if (isThreaded) {
            return {
                end: HoleEnd.TAPPED,
                depth: segment.far,
                engagementStart: segment.near,
                last: segment
            };
        }
        if (segment.closedFar) {
            return {
                end: HoleEnd.BLIND,
                depth: segment.far,
                engagementStart: segment.near,
                last: segment
            };
        }
        reach = segment.far;
        last = segment;
        if (reach > limit) {
            break;
        }
    }
    return { end: HoleEnd.THROUGH, depth: reach, engagementStart: reach, last };
}

interface Washers {
    start?: PartChoice;
    end?: PartChoice;
    startThickness: number;
    endThickness: number;
}

function thickness(catalog: Catalog, washer: PartChoice | undefined): number {
    return washer
        ? (getWasher(catalog, washer.vendor, washer.size, washer.type)
              ?.thickness ?? 0)
        : 0;
}

/** The screw washer, unless under a flat head, and the nut washer, when there's a nut. */
function chooseWashers(
    options: PlanOptions,
    countersunk: boolean,
    end: HoleEnd
): Washers {
    // A washer can't go under a flat head, which sits in its countersink
    const start = countersunk ? undefined : options.screwWasher;
    const nutEnd = nutChoice(options, end) ? options.nutWasher : undefined;
    return {
        start,
        end: nutEnd,
        startThickness: thickness(options.catalog, start),
        endThickness: thickness(options.catalog, nutEnd)
    };
}

/** The nut, where the screw comes out the far side and one is wanted. */
function nutChoice(options: PlanOptions, end: HoleEnd): PartChoice | undefined {
    return end === HoleEnd.THROUGH ? options.nut : undefined;
}

/** A stack's screw, with what's off about it; or why it gets none. */
type ScrewPick = { screw: ScrewChoice; warning?: string } | { error: string };

/** A distance as a message gives it: inches for FRC, millimetres for FTC. */
function formatDistance(meters: number, program: Program): string {
    return program === Program.FTC
        ? `${Number((meters * 1000).toFixed(1))} mm`
        : `${Number((meters / INCH).toFixed(3))} in`;
}

/** The screw for a stack, or why there's none. */
function pickScrew(
    options: PlanOptions,
    size: CatalogSize,
    stack: Stack,
    washers: Washers
): ScrewPick {
    const made = getLengths(
        options.catalog,
        options.screw.vendor,
        size.id,
        options.screw.head,
        options.screw.finish
    );
    if (made.length === 0) {
        return { error: "The vendor doesn't make this head in this size." };
    }
    const isPreset = options.mode === FastenerMode.PRESET;
    const limit = lengthLimit(options);
    const lengths = isPreset
        ? made.filter((each) => each.id === options.screw.length)
        : made.filter(
              (each) =>
                  limit === undefined || each.length <= limit + LINEAR_TOLERANCE
          );
    if (lengths.length === 0) {
        return {
            error: isPreset
                ? "The vendor doesn't make this length in this size and head."
                : "No screw is made within the maximum length."
        };
    }
    const choose = (lengthId: string): ScrewChoice => ({
        vendor: options.screw.vendor,
        size: size.id,
        head: options.screw.head,
        finish: options.screw.finish,
        length: lengthId,
        // A preset's is chosen with its length; an automatic screw is partly threaded, the standard
        fullyThreaded: isPreset ? options.screw.fullyThreaded : "false"
    });
    const distance = (meters: number) =>
        formatDistance(meters, options.program);
    // Where its tip is, for each length: a flat head's top is flush with the circular edge
    const tip = (length: number) => length - washers.startThickness;

    if (stack.end === HoleEnd.THROUGH) {
        const nut = nutChoice(options, stack.end);
        const nutHeight = nut
            ? (getNut(options.catalog, nut.vendor, nut.size, nut.type)
                  ?.height ?? 0)
            : 0;
        // Flush with the nut's far face engages every thread, a nylock's insert included
        const needed =
            stack.depth + (nut ? washers.endThickness + nutHeight : 0);
        const reaching = lengths.find(
            (each) => tip(each.length) >= needed - LINEAR_TOLERANCE
        );
        if (reaching) {
            return { screw: choose(reaching.id) };
        }
        const longest = lengths[lengths.length - 1];
        const named = isPreset
            ? `The ${longest.name} screw`
            : limit !== undefined
              ? `The longest screw within the maximum length, ${longest.name},`
              : `The longest screw, ${longest.name},`;
        return {
            error: `${named} is ${distance(needed - tip(longest.length))} too short to reach through ${nut ? "the nut" : "the parts"}.`
        };
    }

    // Into threads, or a blind hole: as far in as fits, short of a bottom if it has one
    const bottom =
        stack.end === HoleEnd.BLIND || stack.last.closedFar
            ? stack.depth - size.pitch
            : Infinity;
    // A preset is its own length, so only automatic stops at the maximum thread depth
    const maxDepth = isPreset
        ? Infinity
        : stack.engagementStart + options.maxThreadDepth;
    const deepest = Math.min(bottom, maxDepth);
    const shallowest =
        stack.engagementStart +
        Math.min(
            stack.depth - stack.engagementStart,
            MIN_ENGAGEMENT_DIAMETERS * size.majorDiameter,
            isPreset ? Infinity : options.maxThreadDepth
        );
    const over = (length: number) => Math.max(0, tip(length) - deepest);
    const under = (length: number) => Math.max(0, shallowest - tip(length));
    const fitsWithin = (limit: number) =>
        lengths.filter(
            (each) =>
                tip(each.length) <= limit + LINEAR_TOLERANCE &&
                under(each.length) <= LINEAR_TOLERANCE
        );
    // As deep as fits without coming out the far side; then, through threads, the shortest that comes out of it
    const inside = fitsWithin(Math.min(stack.depth, deepest));
    if (inside.length > 0) {
        return { screw: choose(inside[inside.length - 1].id) };
    }
    const [outside] = fitsWithin(deepest);
    if (outside) {
        return { screw: choose(outside.id) };
    }

    // None fits, so the one that misses by least, with a warning that says by how much
    const closest = lengths.reduce((best, each) =>
        over(each.length) + under(each.length) <
        over(best.length) + under(best.length)
            ? each
            : best
    );
    const named = isPreset
        ? `The ${closest.name} screw`
        : `The closest screw, ${closest.name},`;
    const tipAt = tip(closest.length);
    let warning: string;
    if (tipAt > bottom + LINEAR_TOLERANCE) {
        warning = `${named} is ${distance(tipAt - bottom)} too long, so it bottoms out in the hole.`;
    } else if (over(closest.length) > LINEAR_TOLERANCE) {
        warning = `${named} goes ${distance(tipAt - maxDepth)} past the maximum thread depth.`;
    } else {
        const into = distance(Math.max(0, tipAt - stack.engagementStart));
        warning =
            stack.end === HoleEnd.TAPPED
                ? `${named} is ${distance(under(closest.length))} too short: it goes only ${into} into the threads.`
                : `${named} is ${distance(under(closest.length))} too short: it goes only ${into} into the hole.`;
    }
    return { screw: choose(closest.id), warning };
}
