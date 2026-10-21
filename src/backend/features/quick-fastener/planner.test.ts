import { describe, expect, it } from "vitest";
import { Program } from "./catalog";
import {
    DEFAULT_MAX_GAP,
    DEFAULT_MAX_LENGTH,
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

function options(extra: Partial<FastenerOptions> = {}): FastenerOptions {
    return {
        program: Program.FRC,
        mode: FastenerMode.AUTOMATIC,
        vendor: "GENERIC",
        size: "NO_10_32",
        head: "BUTTON",
        startWasher: false,
        endWasher: false,
        washerType: "OD_1_2_X_0_049",
        nutType: "NYLOCK",
        stop: StopCondition.MAX_LENGTH,
        maxLength: DEFAULT_MAX_LENGTH,
        maxGap: DEFAULT_MAX_GAP,
        ...extra
    };
}

function plan(
    holes: AssemblyHole[],
    extra: Partial<FastenerOptions> = {},
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
            length: "IN_0_875"
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

    it("counts the start and end washers chosen", () => {
        const { planned } = plan(TWO_PLATES, {
            startWasher: true,
            endWasher: true
        });
        // Two 0.049 in. washers more: 0.8965 in.
        expect(planned.screw?.length).toBe("IN_1");
        const washer = {
            vendor: "GENERIC",
            size: "NO_10_32",
            type: "OD_1_2_X_0_049"
        };
        expect(planned.startWasher).toEqual(washer);
        expect(planned.endWasher).toEqual(washer);
    });

    it("takes washers from the screw's vendor, where it makes them", () => {
        const { planned } = plan(TWO_PLATES, {
            vendor: "MCMASTER",
            startWasher: true,
            washerType: "OD_7_16_X_0_03"
        });
        expect(planned.startWasher).toEqual({
            vendor: "MCMASTER",
            size: "NO_10_32",
            type: "OD_7_16_X_0_03"
        });
    });

    it("leaves the nut and its washer off without a nut type", () => {
        const { planned, exit } = plan(TWO_PLATES, {
            nutType: undefined,
            endWasher: true
        });
        expect(planned.screw?.length).toBe("IN_0_5");
        expect(planned.nut).toBeUndefined();
        expect(planned.endWasher).toBeUndefined();
        expect(exit).toBeUndefined();
    });

    it("ends in a tapped hole drawn at its tap drill, without a nut", () => {
        const { planned } = plan([
            hole("top", 0, 0.25, 0.201),
            hole("block", 0.25, 1.25, 0.159, { closedAtEnd: true })
        ]);
        expect(planned.end).toBe(HoleEnd.TAPPED);
        expect(planned.nut).toBeUndefined();
        // Short of the bottom by a thread: at most 1.21875 in.
        expect(planned.screw?.length).toBe("IN_1_125");
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
            { size: "QUARTER_20" }
        );
        expect(planned.end).toBe(HoleEnd.TAPPED);
        expect(planned.screw?.length).toBe("IN_1");
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
                nutType: undefined
            });
            expect(short.planned.depth).toBeCloseTo(0.25 * INCH);
            expect(short.planned.screw?.length).toBe("IN_0_25");
        });

        it("respects a gap wider than the maximum gap, and ignores a narrower one", () => {
            const respect = { stop: StopCondition.RESPECT_GAPS };
            expect(plan(gapped(0.25), respect).planned.depth).toBeCloseTo(
                0.25 * INCH
            );
            expect(plan(gapped(0.02), respect).planned.depth).toBeCloseTo(
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
        const preset = { mode: FastenerMode.PRESET, length: "IN_1_5" };
        expect(plan(TWO_PLATES, preset).planned.screw?.length).toBe("IN_1_5");
    });

    it("lets a flat head's hole start below its countersink, with no washer under it", () => {
        const { planned } = plan(
            [hole("top", 0.12, 0.25, 0.201), hole("bottom", 0.25, 0.5, 0.201)],
            { head: "FLAT", startWasher: true }
        );
        expect(planned.status).toBe(HoleStatus.READY);
        expect(planned.startWasher).toBeUndefined();
    });

    it("only offers what the vendor makes, with Generic's nuts where it makes none", () => {
        const { planned } = plan(TWO_PLATES, { vendor: "REV" });
        expect(planned.screw?.vendor).toBe("REV");
        expect(planned.nut?.vendor).toBe("GENERIC");
        expect(
            plan(TWO_PLATES, { vendor: "WCP", head: "FLAT" }).planned.status
        ).toBe(HoleStatus.NO_FIT);
    });
});
