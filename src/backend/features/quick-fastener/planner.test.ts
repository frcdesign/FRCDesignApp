import { describe, expect, it } from "vitest";
import { Program } from "./catalog";
import {
    DEFAULT_MAX_GAP,
    DEFAULT_MAX_LENGTH,
    DEFAULT_MAX_THREAD_DEPTH,
    FastenerMode,
    type FastenerOptions,
    HoleEnd,
    HoleStatus,
    StopCondition
} from "./contract";
import {
    type AssemblyCircularEdge,
    type AssemblyHole,
    planHoles,
    type PlacedScrew
} from "./planner";
import { type PartChoice, type ScrewChoice } from "./studios";

const INCH = 0.0254;

/** Holes along -Z from the origin, as plates stack under a circular edge on top: depths in inches. */
function hole(
    part: string,
    top: number,
    bottom: number,
    diameter: number,
    extra: Partial<AssemblyHole> = {}
): AssemblyHole {
    return {
        occurrencePath: [part],
        origin: [0, 0, 0],
        direction: [0, 0, -1],
        radius: (diameter * INCH) / 2,
        start: top * INCH,
        end: bottom * INCH,
        closedAtStart: false,
        closedAtEnd: false,
        threaded: false,
        edges: [
            { id: `${part}-top`, at: top * INCH },
            { id: `${part}-bottom`, at: bottom * INCH }
        ],
        ...extra
    };
}

const CIRCULAR_EDGE: AssemblyCircularEdge = {
    key: "top|edge",
    occurrencePath: ["top"],
    edgeId: "top-top",
    center: [0, 0, 0],
    normal: [0, 0, 1],
    radius: 0.1
};

const WASHER: PartChoice = {
    vendor: "GENERIC",
    size: "NO_10_32",
    type: "OD_1_2_X_0_049"
};

const NYLOCK: PartChoice = {
    vendor: "GENERIC",
    size: "NO_10_32",
    type: "NYLOCK"
};

interface ExtraOptions extends Partial<Omit<FastenerOptions, "screw">> {
    screw?: Partial<ScrewChoice>;
}

function options(extra: ExtraOptions = {}): FastenerOptions {
    const { screw, ...rest } = extra;
    return {
        program: Program.FRC,
        mode: FastenerMode.AUTOMATIC,
        screw: {
            vendor: "GENERIC",
            size: "NO_10_32",
            head: "BUTTON",
            length: "IN_0_5",
            variant: "STANDARD",
            ...screw
        },
        nut: NYLOCK,
        stop: StopCondition.MAX_LENGTH,
        maxLength: DEFAULT_MAX_LENGTH,
        maxGap: DEFAULT_MAX_GAP,
        maxThreadDepth: DEFAULT_MAX_THREAD_DEPTH,
        replicate: false,
        ...rest
    };
}

function plan(
    holes: AssemblyHole[],
    extra: ExtraOptions = {},
    placed: PlacedScrew[] = []
) {
    const [only] = planHoles([CIRCULAR_EDGE], holes, placed, options(extra));
    return only;
}

const TWO_PLATES = [
    hole("top", 0, 0.25, 0.201),
    hole("bottom", 0.25, 0.5, 0.201)
];

describe("planHoles", () => {
    it("bolts through two plates, long enough for a nylock", () => {
        const { planned, exit } = plan(TWO_PLATES);
        expect(planned.status).toBe(HoleStatus.READY);
        expect(planned.end).toBe(HoleEnd.THROUGH);
        expect(planned.depth).toBeCloseTo(0.5 * INCH);
        // 1/2 in. of plate, a 0.236 in. nut and two threads: 0.7985 in.
        expect(planned.screw).toEqual({
            vendor: "GENERIC",
            size: "NO_10_32",
            head: "BUTTON",
            length: "IN_0_875",
            variant: "STANDARD"
        });
        expect(planned.nut).toEqual({
            vendor: "GENERIC",
            size: "NO_10_32",
            type: "NYLOCK"
        });
        expect(exit?.edge).toEqual({
            occurrencePath: ["bottom"],
            edgeId: "bottom-bottom"
        });
        expect(exit?.point[2]).toBeCloseTo(-0.5 * INCH);
    });

    it("counts the screw and nut washers chosen", () => {
        const { planned } = plan(TWO_PLATES, {
            screwWasher: WASHER,
            nutWasher: WASHER
        });
        // Two 0.049 in. washers more: 0.8965 in.
        expect(planned.screw?.length).toBe("IN_1");
        expect(planned.screwWasher).toEqual(WASHER);
        expect(planned.nutWasher).toEqual(WASHER);
    });

    it("takes each part from its own vendor", () => {
        const mcmaster = {
            ...WASHER,
            vendor: "MCMASTER",
            type: "OD_7_16_X_0_03"
        };
        const { planned } = plan(TWO_PLATES, {
            screw: { vendor: "REV" },
            screwWasher: mcmaster
        });
        expect(planned.screw?.vendor).toBe("REV");
        expect(planned.screwWasher).toEqual(mcmaster);
        expect(planned.nut).toEqual(NYLOCK);
    });

    it("leaves the nut and its washer off without a nut", () => {
        const { planned, exit } = plan(TWO_PLATES, {
            nut: undefined,
            nutWasher: WASHER
        });
        expect(planned.screw?.length).toBe("IN_0_5");
        expect(planned.nut).toBeUndefined();
        expect(planned.nutWasher).toBeUndefined();
        expect(exit).toBeUndefined();
    });

    it("ends in a tapped hole drawn at its tap drill, without a nut", () => {
        const { planned } = plan([
            hole("top", 0, 0.25, 0.201),
            hole("block", 0.25, 1.25, 0.159, { closedAtEnd: true })
        ]);
        expect(planned.end).toBe(HoleEnd.TAPPED);
        expect(planned.nut).toBeUndefined();
        // Half an inch into the threads, which start at 1/4 in.
        expect(planned.screw?.length).toBe("IN_0_75");
    });

    it("goes as deep into threads as the maximum thread depth lets it, short of the bottom", () => {
        const block = [
            hole("top", 0, 0.25, 0.201),
            hole("block", 0.25, 1.25, 0.159, { closedAtEnd: true })
        ];
        // Short of the bottom by a thread: at most 1.21875 in.
        expect(
            plan(block, { maxThreadDepth: 2 * INCH }).planned.screw?.length
        ).toBe("IN_1_125");
        expect(
            plan(block, { maxThreadDepth: 0.25 * INCH }).planned.screw?.length
        ).toBe("IN_0_5");
    });

    it("ends in a Hole feature's threads of its size", () => {
        const { planned } = plan(
            [
                hole("top", 0, 0.25, 0.266),
                hole("block", 0.25, 1, 0.201, {
                    threaded: true,
                    majorDiameter: 0.25 * INCH
                })
            ],
            { screw: { size: "QUARTER_20" } }
        );
        expect(planned.end).toBe(HoleEnd.TAPPED);
        expect(planned.screw?.length).toBe("IN_0_75");
    });

    it("isn't fooled by a clearance hole the size of a bigger screw's tap drill", () => {
        // 0.201 in. is #10's free clearance and 1/4-20's tap drill
        expect(plan(TWO_PLATES).planned.end).toBe(HoleEnd.THROUGH);
    });

    it("ends at the bottom of a blind hole", () => {
        const { planned } = plan([
            hole("top", 0, 0.25, 0.201),
            hole("block", 0.25, 0.75, 0.201, { closedAtEnd: true })
        ]);
        expect(planned.end).toBe(HoleEnd.BLIND);
        expect(planned.nut).toBeUndefined();
        // At most 0.75 - 1/32 in.
        expect(planned.screw?.length).toBe("IN_0_625");
    });

    describe("stopping", () => {
        const gapped = (gap: number) => [
            hole("top", 0, 0.25, 0.201),
            hole("far", 0.25 + gap, 0.5 + gap, 0.201)
        ];

        it("reaches across any gap up to the maximum length", () => {
            expect(plan(gapped(0.25)).planned.depth).toBeCloseTo(0.75 * INCH);
            // The far plate starts past 0.4 in.
            const short = plan(gapped(0.25), {
                maxLength: 0.4 * INCH,
                nut: undefined
            });
            expect(short.planned.depth).toBeCloseTo(0.25 * INCH);
            expect(short.planned.screw?.length).toBe("IN_0_25");
        });

        it("respects a gap wider than the maximum gap, and ignores a narrower one", () => {
            const firstGap = { stop: StopCondition.FIRST_GAP };
            expect(plan(gapped(0.25), firstGap).planned.depth).toBeCloseTo(
                0.25 * INCH
            );
            expect(plan(gapped(0.02), firstGap).planned.depth).toBeCloseTo(
                0.52 * INCH
            );
        });

        it("says no screw reaches past the maximum length", () => {
            const deep = [
                hole("top", 0, 2, 0.201),
                hole("bottom", 2, 3, 0.201)
            ];
            const { planned } = plan(deep);
            expect(planned.status).toBe(HoleStatus.NO_FIT);
            expect(planned.reason).toMatch(/maximum length/);
        });
    });

    it("leaves a hole alone that already has a screw", () => {
        const placed: PlacedScrew[] = [{ origin: [0, 0, 0], axis: [0, 0, 1] }];
        expect(plan(TWO_PLATES, {}, placed).planned.status).toBe(
            HoleStatus.FASTENED
        );
        const elsewhere: PlacedScrew[] = [
            { origin: [0.01, 0, 0], axis: [0, 0, 1] }
        ];
        expect(plan(TWO_PLATES, {}, elsewhere).planned.status).toBe(
            HoleStatus.READY
        );
    });

    it("refuses a circular edge with no hole under it, or too small a hole", () => {
        expect(plan([hole("other", 0.5, 1, 0.201)]).planned.status).toBe(
            HoleStatus.NO_FIT
        );
        const small = plan([hole("top", 0, 0.25, 0.15)]);
        expect(small.planned.status).toBe(HoleStatus.NO_FIT);
        expect(small.planned.reason).toMatch(/too small for a #10-32/);
    });

    it("puts a preset screw where it fits", () => {
        const preset = {
            mode: FastenerMode.PRESET,
            screw: { length: "IN_1_5" }
        };
        expect(plan(TWO_PLATES, preset).planned.screw?.length).toBe("IN_1_5");
    });

    it("keeps a preset screw's variant, and sizes an automatic one from the standard line", () => {
        const zinc = { vendor: "MCMASTER", variant: "ZINC_PLATED" };
        const preset = plan(TWO_PLATES, {
            mode: FastenerMode.PRESET,
            screw: { ...zinc, length: "IN_1" }
        });
        expect(preset.planned.screw?.variant).toBe("ZINC_PLATED");
        const automatic = plan(TWO_PLATES, { screw: zinc });
        expect(automatic.planned.screw?.variant).toBe("STANDARD");
    });

    it("lets a flat head's hole start below its countersink, with no washer under it", () => {
        const { planned } = plan(
            [hole("top", 0.12, 0.25, 0.201), hole("bottom", 0.25, 0.5, 0.201)],
            { screw: { head: "FLAT" }, screwWasher: WASHER }
        );
        expect(planned.status).toBe(HoleStatus.READY);
        expect(planned.screwWasher).toBeUndefined();
    });

    it("only offers what the vendor makes", () => {
        expect(
            plan(TWO_PLATES, { screw: { vendor: "WCP", head: "FLAT" } }).planned
                .status
        ).toBe(HoleStatus.NO_FIT);
    });
});
