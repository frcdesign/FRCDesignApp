import { describe, expect, it } from "vitest";
import { FASTENER_SET } from "../../../__test_utils__/fastener-set";
import { type PartOccurrence } from "./assembly";
import { frameTransform, type Vec3 } from "./geometry";
import { type AssemblyHole } from "./planner";
import { orphanedMates, screwLength, seatEdge, stackParts } from "./replace";
import { FastenerKind } from "./studios";

const INCH = 0.0254;
const UP: Vec3 = [0, 0, 1];
const DOWN: Vec3 = [0, 0, -1];

/** A 1/4 in. plate's hole on the Z axis, from z = 0 up to its top edge. */
const PLATE_HOLE: AssemblyHole = {
    occurrencePath: ["plate"],
    origin: [0, 0, 0],
    direction: UP,
    radius: 0.1 * INCH,
    start: 0,
    end: 0.25 * INCH,
    closedAtStart: false,
    closedAtEnd: false,
    threaded: false,
    edges: [
        { id: "bottom", at: 0 },
        { id: "top", at: 0.25 * INCH }
    ]
};

function part(
    kind: FastenerKind,
    id: string,
    origin: Vec3,
    zAxis: Vec3,
    configuration?: string
): PartOccurrence {
    const location = FASTENER_SET.studios[kind].location;
    return {
        path: [id],
        transform: frameTransform(origin, zAxis),
        partId: "JHD",
        documentId: location.documentId,
        elementId: location.elementId,
        isStandardContent: false,
        source: {
            path: { ...location, instanceType: "v", instanceId: "libv" },
            configuration,
            key: id
        }
    };
}

describe("seatEdge", () => {
    it("finds the edge a screw sits on, under its head or a washer", () => {
        const onEdge = { origin: [0, 0, 0.25 * INCH] as Vec3, axis: UP };
        expect(seatEdge(onEdge, [PLATE_HOLE], 0.06 * INCH)).toMatchObject({
            key: "plate|top",
            normal: UP
        });
        const onWasher = { origin: [0, 0, 0.3 * INCH] as Vec3, axis: UP };
        expect(seatEdge(onWasher, [PLATE_HOLE], 0.06 * INCH)?.edgeId).toBe(
            "top"
        );
    });

    it("finds none off the hole's axis, or with no hole under the head", () => {
        const aside = { origin: [1, 0, 0.25 * INCH] as Vec3, axis: UP };
        expect(seatEdge(aside, [PLATE_HOLE], 0.06 * INCH)).toBeUndefined();
        // Pointing up from under the plate, the hole is above its head
        const under = { origin: [0, 0, 0] as Vec3, axis: UP };
        expect(seatEdge(under, [PLATE_HOLE], 0.06 * INCH)).toBeUndefined();
    });
});

describe("stackParts", () => {
    const [length] = FASTENER_SET.catalog.screws[0].lengths;
    const screw = part(
        FastenerKind.SCREW,
        "screw",
        [0, 0, 0.25 * INCH],
        UP,
        `length=${length.id}`
    );

    it("takes the washers and nuts on the screw's axis, within its length", () => {
        const washer = part(
            FastenerKind.WASHER,
            "washer",
            [0, 0, 0.2 * INCH],
            UP
        );
        const nut = part(
            FastenerKind.NUT,
            "nut",
            [0, 0, 0.25 * INCH - length.length + 0.01 * INCH],
            DOWN
        );
        const beyond = part(
            FastenerKind.NUT,
            "beyond",
            [0, 0, 0.25 * INCH - length.length - 0.1 * INCH],
            DOWN
        );
        const aside = part(FastenerKind.NUT, "aside", [1, 0, 0], DOWN);
        const otherScrew = part(FastenerKind.SCREW, "other", [0, 0, 0], UP);

        expect(
            stackParts(
                screw,
                length.length,
                [screw, washer, nut, beyond, aside, otherScrew],
                FASTENER_SET
            ).map((each) => each.path[0])
        ).toEqual(["washer", "nut"]);
    });

    it("reads the screw's length from its configuration, or the studio's default", () => {
        expect(screwLength(FASTENER_SET, screw)).toBeCloseTo(length.length);
        const unconfigured = part(FastenerKind.SCREW, "plain", [0, 0, 0], UP);
        expect(screwLength(FASTENER_SET, unconfigured)).toBeGreaterThan(0);
    });
});

describe("orphanedMates", () => {
    it("names the mates referencing a deleted instance, anywhere in their queries", () => {
        const mate = (featureId: string, path: string[]) => ({
            featureId,
            featureType: "mate",
            parameters: [
                {
                    parameterId: "mateConnectorsQuery",
                    queries: [{ path, featureId: "FS.mateConnector" }]
                }
            ]
        });
        expect(
            orphanedMates(
                [
                    mate("onScrew", ["screw"]),
                    mate("elsewhere", ["bracket"]),
                    {
                        ...mate("connector", ["screw"]),
                        featureType: "mateConnector"
                    }
                ],
                ["screw", "nut"]
            )
        ).toEqual(["onScrew"]);
    });
});
