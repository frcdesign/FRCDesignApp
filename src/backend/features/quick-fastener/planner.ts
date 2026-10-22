/**
 * Picks the fastener for each hole: pure, from the assembly's holes and the
 * circular edges picked, both in the assembly's coordinates.
 *
 * A hole is followed from its circular edge into the parts, through every hole on the
 * same axis, until it ends: in threads (tapped), at the bottom of a hole
 * (blind), or out the far side (through, where a nut goes). It stops at the
 * maximum length, or at the first gap wider than the maximum gap. A screw goes
 * no deeper into threads than the maximum thread depth.
 */
import {
    catalog,
    type CatalogSize,
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
    /** The picked face it's on, when no hole of that face is skipped: a Replicate can match the face. */
    face?: string;
}

/** A library screw already in the assembly, from Quick fastener or not: its origin and Z axis. */
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

const MAX_WASHER_THICKNESS = Math.max(
    ...catalog.washers.map((washer) => washer.thickness)
);

/** Two threads past a nut, so it's fully engaged. */
const THREADS_PAST_NUT = 2;

/** A screw goes at least this many diameters into threads, or as far as they go. */
const MIN_ENGAGEMENT_DIAMETERS = 1;

/** How close a hole is to a size's tap drill to be taken for a tapped hole drawn without threads. */
const TAP_DRILL_RATIO = 0.03;

export function planHoles(
    circularEdges: AssemblyCircularEdge[],
    holes: AssemblyHole[],
    placed: PlacedScrew[],
    options: FastenerOptions
): HolePlan[] {
    return circularEdges.map((circularEdge) =>
        planHole(circularEdge, holes, placed, options)
    );
}

function planHole(
    circularEdge: AssemblyCircularEdge,
    holes: AssemblyHole[],
    placed: PlacedScrew[],
    options: FastenerOptions
): HolePlan {
    const plan = (planned: Omit<PlannedHole, "key">): HolePlan => ({
        planned: { key: circularEdge.key, ...planned },
        circularEdge
    });
    const into = scale(circularEdge.normal, -1);

    if (placed.some((screw) => isInHole(screw, circularEdge, into))) {
        return plan({ status: HoleStatus.FASTENED });
    }

    const size = getSize(options.screw.size);
    const head = getHead(options.screw.head)?.sizes[options.screw.size];
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

    const stack = followStack(segments, first, size, options);
    const end = stack.end;
    const washers = chooseWashers(options, head.countersunk, end);
    const screw = pickScrew(options, size, stack, washers);
    if (typeof screw === "string") {
        return plan({ status: HoleStatus.NO_FIT, reason: screw, end });
    }
    const planned: Omit<PlannedHole, "key"> = {
        status: HoleStatus.READY,
        end,
        depth: stack.depth,
        screw,
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
        return plan({
            ...planned,
            reason: "No edge on the far side to fasten a nut to."
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
    into: Vec3
): boolean {
    return (
        isParallel(screw.axis, into) &&
        distanceToLine(screw.origin, circularEdge.center, into) <
            LINEAR_TOLERANCE &&
        // At the circular edge, or seated on a washer above it
        Math.abs(dot(screw.origin, into) - dot(circularEdge.center, into)) <=
            MAX_WASHER_THICKNESS + LINEAR_TOLERANCE
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
function longestLength(options: FastenerOptions): number {
    const { vendor, size, head } = options.screw;
    const lengths = getLengths(vendor, size, head, options.screw.finish);
    return lengths.length > 0 ? lengths[lengths.length - 1].length : 0;
}

/** The deepest a stack is followed, and the widest gap it reaches across. */
function stopLimits(options: FastenerOptions): {
    reach: number;
    gap: number;
} {
    if (options.stop === StopCondition.FIRST_GAP) {
        return { reach: longestLength(options), gap: options.maxGap };
    }
    return { reach: options.maxLength, gap: Infinity };
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
    options: FastenerOptions
): Stack {
    const limits = stopLimits(options);
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
        const gap = segment.near - reach;
        if (
            gap > limits.gap + LINEAR_TOLERANCE ||
            segment.near > limits.reach
        ) {
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
        if (reach > limits.reach) {
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

function thickness(washer: PartChoice | undefined): number {
    return washer
        ? (getWasher(washer.vendor, washer.size, washer.type)?.thickness ?? 0)
        : 0;
}

/** The screw washer, unless under a flat head, and the nut washer, when there's a nut. */
function chooseWashers(
    options: FastenerOptions,
    countersunk: boolean,
    end: HoleEnd
): Washers {
    // A washer can't go under a flat head, which sits in its countersink
    const start = countersunk ? undefined : options.screwWasher;
    const nutEnd = nutChoice(options, end) ? options.nutWasher : undefined;
    return {
        start,
        end: nutEnd,
        startThickness: thickness(start),
        endThickness: thickness(nutEnd)
    };
}

/** The nut, where the screw comes out the far side and one is wanted. */
function nutChoice(
    options: FastenerOptions,
    end: HoleEnd
): PartChoice | undefined {
    return end === HoleEnd.THROUGH ? options.nut : undefined;
}

/** The screw for a stack, or why there's none. */
function pickScrew(
    options: FastenerOptions,
    size: CatalogSize,
    stack: Stack,
    washers: Washers
): ScrewChoice | string {
    const made = getLengths(
        options.screw.vendor,
        size.id,
        options.screw.head,
        options.screw.finish
    );
    if (made.length === 0) {
        return "The vendor doesn't make this head in this size.";
    }
    // Where its tip is, for each length: a flat head's top is flush with the circular edge
    const tip = (length: number) => length - washers.startThickness;
    const lengths =
        options.mode === FastenerMode.PRESET
            ? made.filter((each) => each.id === options.screw.length)
            : made.filter(
                  (each) =>
                      options.stop !== StopCondition.MAX_LENGTH ||
                      each.length <= options.maxLength + LINEAR_TOLERANCE
              );
    const choose = (lengthId: string): ScrewChoice => ({
        vendor: options.screw.vendor,
        size: size.id,
        head: options.screw.head,
        finish: options.screw.finish,
        length: lengthId,
        // A preset's is chosen with its length; an automatic screw is partly threaded, the standard
        fullyThreaded:
            options.mode === FastenerMode.PRESET
                ? options.screw.fullyThreaded
                : "false"
    });

    if (stack.end === HoleEnd.THROUGH) {
        const nut = nutChoice(options, stack.end);
        const nutHeight = nut
            ? (getNut(nut.vendor, nut.size, nut.type)?.height ?? 0)
            : 0;
        const needed =
            stack.depth +
            (nut
                ? washers.endThickness +
                  nutHeight +
                  THREADS_PAST_NUT * size.pitch
                : 0);
        if (options.mode === FastenerMode.PRESET) {
            return lengths.length > 0
                ? choose(lengths[0].id)
                : "The vendor doesn't make this length in this size and head.";
        }
        const shortest = lengths.find(
            (each) => tip(each.length) >= needed - LINEAR_TOLERANCE
        );
        if (shortest) {
            return choose(shortest.id);
        }
        return options.stop === StopCondition.MAX_LENGTH
            ? "No screw reaches through within the maximum length."
            : "No screw is long enough to reach through.";
    }

    // Into threads, or the bottom of a blind hole: as far in as fits, short of the bottom
    const isPreset = options.mode === FastenerMode.PRESET;
    const bottom = stack.depth - (stack.last.closedFar ? size.pitch : 0);
    // A preset is its own length, so only automatic stops at the maximum thread depth
    const deepest = isPreset
        ? bottom
        : Math.min(bottom, stack.engagementStart + options.maxThreadDepth);
    const engagement = Math.min(
        stack.depth - stack.engagementStart,
        MIN_ENGAGEMENT_DIAMETERS * size.majorDiameter,
        isPreset ? Infinity : options.maxThreadDepth
    );
    const fitting = lengths.filter(
        (each) =>
            tip(each.length) <= deepest + LINEAR_TOLERANCE &&
            tip(each.length) >=
                stack.engagementStart + engagement - LINEAR_TOLERANCE
    );
    if (isPreset) {
        return fitting.length > 0
            ? choose(fitting[0].id)
            : "The screw is too long or too short for this hole.";
    }
    const longest = fitting[fitting.length - 1];
    return longest
        ? choose(longest.id)
        : stack.end === HoleEnd.TAPPED
          ? "No screw length engages the threads within the maximum thread depth without bottoming out."
          : "No screw length fits the blind hole within the maximum thread depth.";
}
