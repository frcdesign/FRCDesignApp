/** Quick fastener's choices: their defaults, keeping them consistent as they change, and how a hole's plan reads. */
import {
    GENERIC,
    getHead,
    getLengths,
    getNutTypes,
    getScrewHeads,
    getScrewSizes,
    getScrewVendors,
    getSize,
    getWashers,
    Program
} from "@backend/features/quick-fastener/catalog";
import {
    DEFAULT_MAX_GAP,
    DEFAULT_MAX_LENGTH,
    FastenerMode,
    type FastenerOptions,
    HoleEnd,
    HoleStatus,
    type PlannedHole,
    StopCondition
} from "@backend/features/quick-fastener/contract";

const DEFAULT_SIZE = "NO_10_32";
const DEFAULT_HEAD = "BUTTON";
const DEFAULT_LENGTH = "IN_0_5";
const DEFAULT_NUT = "NYLOCK";

export function defaultOptions(): FastenerOptions {
    return consistentOptions({
        program: Program.FRC,
        mode: FastenerMode.AUTOMATIC,
        vendor: GENERIC,
        size: DEFAULT_SIZE,
        head: DEFAULT_HEAD,
        length: DEFAULT_LENGTH,
        startWasher: false,
        endWasher: false,
        nutType: DEFAULT_NUT,
        stop: StopCondition.MAX_LENGTH,
        maxLength: DEFAULT_MAX_LENGTH,
        maxGap: DEFAULT_MAX_GAP
    });
}

/** `wanted` when it's one of `ids`, else the first. */
function pick(ids: string[], wanted: string | undefined): string | undefined {
    return wanted !== undefined && ids.includes(wanted) ? wanted : ids[0];
}

/**
 * Options with every choice one the catalog makes, given the ones before it:
 * a vendor's sizes, the heads it makes in them, their lengths, and the washers
 * and nuts made in the size. The choice that changed is kept where it can be,
 * and later ones follow it.
 */
export function consistentOptions(options: FastenerOptions): FastenerOptions {
    const vendor =
        pick(
            getScrewVendors().map((each) => each.id),
            options.vendor
        ) ?? GENERIC;
    const size =
        pick(
            getScrewSizes(vendor).map((each) => each.id),
            options.size
        ) ?? DEFAULT_SIZE;
    const head =
        pick(
            getScrewHeads(vendor, size).map((each) => each.id),
            options.head
        ) ?? DEFAULT_HEAD;
    const length = pick(
        getLengths(vendor, size, head).map((each) => each.id),
        options.length
    );
    const washerType = pick(
        getWashers(vendor, size).map((each) => each.type),
        options.washerType
    );
    const nutType =
        options.nutType === undefined
            ? undefined
            : pick(
                  getNutTypes(size).map((each) => each.id),
                  options.nutType
              );
    return {
        ...options,
        vendor,
        size,
        head,
        length,
        washerType,
        nutType,
        // A washer can't go under a flat head, which sits in its countersink
        startWasher: options.startWasher && !isCountersunk(head),
        endWasher: nutType !== undefined && options.endWasher
    };
}

export function isCountersunk(headId: string): boolean {
    return Object.values(getHead(headId)?.sizes ?? {}).some(
        (each) => each.countersunk
    );
}

const END_NAMES: Record<HoleEnd, string> = {
    [HoleEnd.THROUGH]: "through",
    [HoleEnd.TAPPED]: "into threads",
    [HoleEnd.BLIND]: "into a blind hole"
};

/** e.g. `#10-32 x 7/8 in. Button head, Nylock nut`; or why the hole got nothing. */
export function describePlan(planned: PlannedHole): string {
    if (planned.status === HoleStatus.FASTENED) {
        return "Already fastened";
    }
    if (planned.status !== HoleStatus.READY || !planned.screw) {
        return planned.reason ?? "Can't be fastened";
    }
    const { screw } = planned;
    const length = getLengths(screw.vendor, screw.size, screw.head).find(
        (each) => each.id === screw.length
    );
    const parts = [
        `${getSize(screw.size)?.name ?? screw.size} x ${length?.name ?? screw.length} ${getHead(screw.head)?.name ?? screw.head}`
    ];
    if (planned.nut) {
        const type = getNutTypes().find(
            (each) => each.id === planned.nut?.type
        );
        parts.push(`${type?.name ?? planned.nut.type} nut`);
    } else if (planned.end) {
        parts.push(END_NAMES[planned.end]);
    }
    return parts.join(", ");
}
