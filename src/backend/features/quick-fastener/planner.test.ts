import { describe, expect, it } from "vitest";
import { Program } from "./catalog";
import {
    DEFAULT_MAX_LENGTH,
    FastenerMode,
    type FastenerOptions,
    HoleEnd,
    HoleStatus
} from "./contract";
import {
    type AssemblyCircle,
    type AssemblyHole,
    planHoles,
    type PlacedScrew
} from "./planner";

const INCH = 0.0254;

/** Holes along -Z from the origin, as plates stack under a circle on top: depths in inches. */
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

const CIRCLE: AssemblyCircle = {
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
        head: "BUTTON",
        headWasher: false,
        nutType: "NYLOCK",
        nutWasher: false,
        maxLength: DEFAULT_MAX_LENGTH,
        upToNext: false,
        ...extra
    };
}

function plan(
    holes: AssemblyHole[],
    extra: Partial<FastenerOptions> = {},
    placed: PlacedScrew[] = []
) {
    const [only] = planHoles([CIRCLE], holes, placed, options(extra));
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
            washer: false
        });
        expect(planned.nut).toEqual({
            vendor: "GENERIC",
            size: "NO_10_32",
            type: "NYLOCK",
            washer: false
        });
        expect(exit?.edge).toEqual({
            occurrencePath: ["bottom"],
            edgeId: "bottom-bottom"
        });
        expect(exit?.point[2]).toBeCloseTo(-0.5 * INCH);
    });

    it("counts washers under the head and the nut", () => {
        const { planned } = plan(TWO_PLATES, {
            headWasher: true,
            nutWasher: true
        });
        // Two 0.049 in. seat washers more: 0.8965 in.
        expect(planned.screw?.length).toBe("IN_1");
        expect(planned.screw?.washer).toBe(true);
        const washer = {
            vendor: "GENERIC",
            size: "NO_10_32",
            type: "OD_1_2_X_0_049"
        };
        expect(planned.headWasher).toEqual(washer);
        expect(planned.nutWasher).toEqual(washer);
        expect(planned.nut?.washer).toBe(true);
    });

    it("leaves the nut off without a nut type", () => {
        const { planned, exit } = plan(TWO_PLATES, { nutType: undefined });
        expect(planned.screw?.length).toBe("IN_0_5");
        expect(planned.nut).toBeUndefined();
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

    it("sizes by a Hole feature's threads", () => {
        const { planned } = plan([
            hole("top", 0, 0.25, 0.266),
            hole("block", 0.25, 1, 0.201, {
                threaded: true,
                majorDiameter: 0.25 * INCH
            })
        ]);
        expect(planned.end).toBe(HoleEnd.TAPPED);
        expect(planned.screw?.size).toBe("QUARTER_20");
        expect(planned.screw?.length).toBe("IN_1");
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

    it("bridges a gap, or stops at it up to next", () => {
        const gapped = [
            hole("top", 0, 0.25, 0.201),
            hole("far", 0.5, 0.75, 0.201)
        ];
        expect(plan(gapped).planned.depth).toBeCloseTo(0.75 * INCH);
        expect(plan(gapped, { upToNext: true }).planned.depth).toBeCloseTo(
            0.25 * INCH
        );
    });

    it("stops at the maximum length", () => {
        const deep = [hole("top", 0, 2, 0.201), hole("bottom", 2, 3, 0.201)];
        const { planned } = plan(deep);
        expect(planned.status).toBe(HoleStatus.NO_FIT);
        expect(planned.reason).toMatch(/maximum length/);
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

    it("refuses a circle with no hole under it", () => {
        expect(plan([hole("other", 0.5, 1, 0.201)]).planned.status).toBe(
            HoleStatus.NO_FIT
        );
    });

    it("puts a preset screw where it fits", () => {
        const preset = {
            mode: FastenerMode.PRESET,
            size: "NO_10_32",
            length: "IN_1_5"
        };
        expect(plan(TWO_PLATES, preset).planned.screw?.length).toBe("IN_1_5");
        expect(plan([hole("top", 0, 0.25, 0.15)], preset).planned.status).toBe(
            HoleStatus.NO_FIT
        );
    });

    it("lets a flat head's hole start below its countersink, with no washer under it", () => {
        const { planned } = plan(
            [hole("top", 0.12, 0.25, 0.201), hole("bottom", 0.25, 0.5, 0.201)],
            { head: "FLAT", headWasher: true }
        );
        expect(planned.status).toBe(HoleStatus.READY);
        expect(planned.screw?.washer).toBe(false);
        expect(planned.headWasher).toBeUndefined();
    });

    it("only offers what the vendor makes, with Generic's nuts where it makes none", () => {
        const { planned } = plan(TWO_PLATES, { vendor: "REV" });
        expect(planned.screw?.vendor).toBe("REV");
        expect(planned.nut?.vendor).toBe("GENERIC");
        // REV only makes #10-32, too small for a 1/4-20 clearance hole
        expect(
            plan([hole("top", 0, 0.25, 0.266)], { vendor: "REV" }).planned
                .status
        ).toBe(HoleStatus.NO_FIT);
        expect(
            plan(TWO_PLATES, { vendor: "WCP", head: "FLAT" }).planned.status
        ).toBe(HoleStatus.NO_FIT);
    });

    it("picks the largest screw a clearance hole fits", () => {
        expect(plan([hole("top", 0, 0.25, 0.266)]).planned.screw?.size).toBe(
            "QUARTER_20"
        );
        expect(plan([hole("top", 0, 0.25, 0.177)]).planned.screw?.size).toBe(
            "NO_8_32"
        );
    });
});
