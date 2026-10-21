/**
 * Picks the fastener for each hole: pure, from the assembly's holes and the
 * circles selected, both in the assembly's coordinates.
 *
 * A hole is followed from its circle into the parts, through every hole on the
 * same axis, until it ends: in threads (tapped), at the bottom of a hole
 * (blind), or out the far side (through, where a nut goes). Up to next stops
 * at the first gap between parts instead of bridging it.
 */
import {
    catalog,
    type CatalogSize,
    getHead,
    getLengths,
    getNut,
    getNutVendor,
    getScrewSizes,
    getSeatWasher,
    getSize,
    type NutChoice,
    type ScrewChoice,
    seatWasherChoice
} from "./catalog";
import {
    FastenerMode,
    type FastenerOptions,
    HoleEnd,
    HoleStatus,
    type PlannedHole
} from "./contract";
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

/** A circle picked to fasten, in the assembly. */
export interface AssemblyCircle {
    key: string;
    occurrencePath: string[];
    edgeId: string;
    center: Vec3;
    /** Unit, out of the part: a fastener goes in against it. */
    normal: Vec3;
    radius: number;
}

/** A Quick fastener screw already in the assembly: its origin and Z axis. */
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
    circle: AssemblyCircle;
    /** Where the nut seats, out the far side, and the edge it's fastened to. */
    exit?: { point: Vec3; edge: MateEdge };
}

/** A hole met along the axis, measured along it from the circle. */
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

/** A clearance hole is at most this much bigger than its screw: past it, the next size up fits. */
const MAX_CLEARANCE_RATIO = 1.35;

/** How close a hole is to a size's tap drill to be taken for a tapped hole drawn without threads. */
const TAP_DRILL_RATIO = 0.03;

export function planHoles(
    circles: AssemblyCircle[],
    holes: AssemblyHole[],
    placed: PlacedScrew[],
    options: FastenerOptions
): HolePlan[] {
    return circles.map((circle) => planHole(circle, holes, placed, options));
}

function planHole(
    circle: AssemblyCircle,
    holes: AssemblyHole[],
    placed: PlacedScrew[],
    options: FastenerOptions
): HolePlan {
    const plan = (planned: Omit<PlannedHole, "key">): HolePlan => ({
        planned: { key: circle.key, ...planned },
        circle
    });
    const into = scale(circle.normal, -1);

    if (placed.some((screw) => isInHole(screw, circle, into))) {
        return plan({ status: HoleStatus.FASTENED });
    }

    const segments = alongAxis(circle, into, holes);
    const firstAllowance = isCountersunk(options) ? maxHeadHeight(options) : 0;
    const first = segments.find(
        (segment) =>
            segment.near <= firstAllowance + LINEAR_TOLERANCE &&
            segment.far > LINEAR_TOLERANCE
    );
    if (!first) {
        return plan({
            status: HoleStatus.NO_FIT,
            reason: "No hole goes into the part from this circle."
        });
    }

    const size = pickSize(options, first, segments);
    if (!size) {
        return plan({
            status: HoleStatus.NO_FIT,
            reason:
                options.mode === FastenerMode.PRESET
                    ? "The screw doesn't fit through this hole."
                    : "No screw in the catalog fits this hole."
        });
    }

    const stack = followStack(segments, first, size, options);
    const end = stack.end;
    const screw = pickScrew(options, size, stack);
    if (typeof screw === "string") {
        return plan({ status: HoleStatus.NO_FIT, reason: screw, end });
    }

    const headWasher = screw.washer
        ? seatWasherChoice(screw.vendor, size.id)
        : undefined;
    const planned: Omit<PlannedHole, "key"> = {
        status: HoleStatus.READY,
        end,
        depth: stack.depth,
        screw,
        ...(headWasher ? { headWasher } : {})
    };

    const nutVendor = getNutVendor(options.vendor);
    if (
        end !== HoleEnd.THROUGH ||
        !options.nutType ||
        !getNut(nutVendor, size.id, options.nutType)
    ) {
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
    const nut: NutChoice = {
        vendor: nutVendor,
        size: size.id,
        type: options.nutType,
        washer: options.nutWasher
    };
    const nutWasherChoice = options.nutWasher
        ? seatWasherChoice(nutVendor, size.id)
        : undefined;
    return {
        planned: {
            key: circle.key,
            ...planned,
            nut,
            ...(nutWasherChoice ? { nutWasher: nutWasherChoice } : {})
        },
        circle,
        exit: {
            point: add(circle.center, scale(into, stack.depth)),
            edge: {
                occurrencePath: stack.last.hole.occurrencePath,
                edgeId: exitEdge.id
            }
        }
    };
}

function isInHole(
    screw: PlacedScrew,
    circle: AssemblyCircle,
    into: Vec3
): boolean {
    return (
        isParallel(screw.axis, into) &&
        distanceToLine(screw.origin, circle.center, into) < LINEAR_TOLERANCE &&
        // At the circle, or seated on a washer above it
        Math.abs(dot(screw.origin, into) - dot(circle.center, into)) <=
            MAX_WASHER_THICKNESS + LINEAR_TOLERANCE
    );
}

/** Every hole on the circle's axis, as it lies along it, nearest first. */
function alongAxis(
    circle: AssemblyCircle,
    into: Vec3,
    holes: AssemblyHole[]
): Segment[] {
    const t = (point: Vec3) => dot(point, into) - dot(circle.center, into);
    const segments: Segment[] = [];
    for (const hole of holes) {
        if (
            !isParallel(hole.direction, into) ||
            distanceToLine(circle.center, hole.origin, hole.direction) >=
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

function isCountersunk(options: FastenerOptions): boolean {
    const head = getHead(options.head);
    return Object.values(head?.sizes ?? {}).some((each) => each.countersunk);
}

/** A flat head's countersink is above its first hole, so the hole may start this far down. */
function maxHeadHeight(options: FastenerOptions): number {
    const head = getHead(options.head);
    return Math.max(
        0,
        ...Object.values(head?.sizes ?? {}).map((each) => each.height)
    );
}

/** The size whose tap drill this hole is: a tapped hole drawn without threads. */
function tappedSize(
    segment: Segment,
    sizes: CatalogSize[]
): CatalogSize | undefined {
    const diameter = 2 * segment.hole.radius;
    if (segment.hole.threaded && segment.hole.majorDiameter !== undefined) {
        const major = segment.hole.majorDiameter;
        return sizes.find(
            (size) => Math.abs(size.majorDiameter - major) < LINEAR_TOLERANCE
        );
    }
    return sizes.find(
        (size) =>
            Math.abs(diameter - size.tapDrillDiameter) <=
            size.tapDrillDiameter * TAP_DRILL_RATIO
    );
}

function pickSize(
    options: FastenerOptions,
    first: Segment,
    segments: Segment[]
): CatalogSize | undefined {
    const diameter = 2 * first.hole.radius;
    const fits = (size: CatalogSize) =>
        size.majorDiameter <= diameter + LINEAR_TOLERANCE;

    if (options.mode === FastenerMode.PRESET) {
        const size = options.size ? getSize(options.size) : undefined;
        return size && fits(size) ? size : undefined;
    }

    // The sizes the vendor makes this head in
    const sizes = getScrewSizes(options.vendor).filter(
        (size) => getLengths(options.vendor, size.id, options.head).length > 0
    );
    // A tapped hole further on decides the size: one that fits through the clearance hole, and is narrower than it
    const fitting = sizes.filter(fits);
    for (const segment of segments) {
        if (
            segment === first ||
            segment.near < first.far - LINEAR_TOLERANCE ||
            segment.hole.radius >= first.hole.radius - LINEAR_TOLERANCE
        ) {
            continue;
        }
        const tapped = tappedSize(segment, fitting);
        if (tapped) {
            return tapped;
        }
    }
    return sizes
        .filter(
            (size) =>
                fits(size) &&
                diameter <= size.majorDiameter * MAX_CLEARANCE_RATIO
        )
        .sort((a, b) => b.majorDiameter - a.majorDiameter)[0];
}

interface Stack {
    end: HoleEnd;
    /** From the circle to where it ends: the far side, or the bottom of the hole. */
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
        const isGap = segment.near > reach + LINEAR_TOLERANCE;
        if (isGap && (options.upToNext || segment.near > options.maxLength)) {
            break;
        }
        const isThreaded =
            2 * segment.hole.radius < size.majorDiameter &&
            tappedSize(segment, [size])?.id === size.id;
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
        if (reach > options.maxLength) {
            break;
        }
    }
    return { end: HoleEnd.THROUGH, depth: reach, engagementStart: reach, last };
}

/** The screw for a stack, or why there's none. */
function pickScrew(
    options: FastenerOptions,
    size: CatalogSize,
    stack: Stack
): ScrewChoice | string {
    const head = getHead(options.head)?.sizes[size.id];
    const made = getLengths(options.vendor, size.id, options.head);
    if (!head || made.length === 0) {
        return "The vendor doesn't make this head in this size.";
    }
    // A washer can't go under a flat head, which sits in its countersink
    const washer = options.headWasher && !head.countersunk;
    const seatThickness = (vendor: string) =>
        getSeatWasher(vendor, size.id)?.thickness ?? 0;
    // Where its tip is, for each length: a flat head's top is flush with the circle
    const tip = (length: number) =>
        length - (washer ? seatThickness(options.vendor) : 0);

    const lengths =
        options.mode === FastenerMode.PRESET
            ? made.filter((each) => each.id === options.length)
            : made.filter(
                  (each) => each.length <= options.maxLength + LINEAR_TOLERANCE
              );
    const choose = (lengthId: string): ScrewChoice => ({
        vendor: options.vendor,
        size: size.id,
        head: options.head,
        length: lengthId,
        washer
    });

    if (stack.end === HoleEnd.THROUGH) {
        const nutVendor = getNutVendor(options.vendor);
        const nut = options.nutType
            ? getNut(nutVendor, size.id, options.nutType)
            : undefined;
        const needed =
            stack.depth +
            (nut
                ? (options.nutWasher ? seatThickness(nutVendor) : 0) +
                  nut.height +
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
        return shortest
            ? choose(shortest.id)
            : "No screw reaches through within the maximum length.";
    }

    // Into threads, or the bottom of a blind hole: as far in as fits, short of the bottom
    const bottom = stack.depth - (stack.last.closedFar ? size.pitch : 0);
    const engagement = Math.min(
        stack.depth - stack.engagementStart,
        MIN_ENGAGEMENT_DIAMETERS * size.majorDiameter
    );
    const fitting = lengths.filter(
        (each) =>
            tip(each.length) <= bottom + LINEAR_TOLERANCE &&
            tip(each.length) >=
                stack.engagementStart + engagement - LINEAR_TOLERANCE
    );
    if (options.mode === FastenerMode.PRESET) {
        return fitting.length > 0
            ? choose(fitting[0].id)
            : "The screw is too long or too short for this hole.";
    }
    const longest = fitting[fitting.length - 1];
    return longest
        ? choose(longest.id)
        : stack.end === HoleEnd.TAPPED
          ? "No screw length engages the threads without bottoming out."
          : "No screw length fits the blind hole.";
}
