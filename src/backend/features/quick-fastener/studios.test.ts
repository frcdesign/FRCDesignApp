import { describe, expect, it } from "vitest";
import { ParameterType } from "../configurations/contract";
import { getVisibleOptions } from "../configurations/utils";
import {
    FastenerKind,
    GENERIC,
    isMade,
    partVendors,
    settlePart,
    settleScrew,
    STUDIO_PARAMETERS,
    studioConfiguration
} from "./studios";

const SCREW = {
    vendor: GENERIC,
    size: "NO_10_32",
    head: "BUTTON",
    finish: "BLACK",
    length: "IN_0_5",
    fullyThreaded: "false"
};

describe("STUDIO_PARAMETERS", () => {
    it("parses each studio's configuration as Onshape answers it", () => {
        const parameters = STUDIO_PARAMETERS[FastenerKind.SCREW];
        expect(parameters.map((parameter) => parameter.id)).toEqual([
            "vendor",
            "size",
            "head",
            "finish",
            "length",
            "fullyThreaded"
        ]);
        const [, , , , length, fullyThreaded] = parameters;
        expect(length.type).toBe(ParameterType.ENUM);
        expect(length.default).toBe("IN_0_5");
        expect(fullyThreaded.type).toBe(ParameterType.ENUM);
    });

    it("offers Fully threaded only where a length is sold both ways", () => {
        const parameters = STUDIO_PARAMETERS[FastenerKind.SCREW];
        const fullyThreaded = parameters[5];
        if (fullyThreaded.type !== ParameterType.ENUM) {
            throw new Error("Fully threaded is a List of false and true");
        }
        const shown = (length: string, size: string) =>
            getVisibleOptions(
                fullyThreaded,
                {
                    vendor: "MCMASTER",
                    size,
                    head: "SOCKET",
                    finish: "BLACK",
                    length
                },
                parameters
            ).map((option) => option.id);
        expect(shown("IN_2", "NO_8_32")).toEqual(["false", "true"]);
        // Sold one way, so it has nothing to show, and is hidden
        expect(shown("IN_0_5", "NO_8_32")).toEqual([]);
    });
});

describe("settleScrew", () => {
    it("keeps a screw the vendor makes, and moves one it doesn't onto what it does", () => {
        expect(settleScrew(SCREW)).toEqual(SCREW);
        // WCP makes no flat heads, and only #10-32
        const wcp = settleScrew({
            ...SCREW,
            vendor: "WCP",
            size: "QUARTER_20",
            head: "FLAT"
        });
        expect(wcp.size).toBe("NO_10_32");
        expect(wcp.head).not.toBe("FLAT");
        expect(isMade(FastenerKind.SCREW, wcp)).toBe(true);
    });
});

describe("settlePart", () => {
    it("is Generic under a Generic screw, whatever was chosen", () => {
        expect(
            settlePart(FastenerKind.NUT, { vendor: "MCMASTER" }, SCREW)
        ).toEqual({ vendor: GENERIC, size: "NO_10_32", type: "NYLOCK" });
    });

    it("keeps the vendor chosen under another vendor's screw, where it makes the part", () => {
        const rev = { vendor: "REV", size: "NO_10_32" };
        expect(
            settlePart(FastenerKind.NUT, { vendor: "MCMASTER" }, rev)?.vendor
        ).toBe("MCMASTER");
        // REV makes no nuts, so Generic's
        expect(settlePart(FastenerKind.NUT, {}, rev)?.vendor).toBe(GENERIC);
    });

    it("takes the screw's size, and a type made in it", () => {
        const washer = settlePart(
            FastenerKind.WASHER,
            { type: "OD_1_2_X_0_049" },
            { vendor: "MCMASTER", size: "QUARTER_20" }
        );
        expect(washer?.size).toBe("QUARTER_20");
        expect(washer && isMade(FastenerKind.WASHER, washer)).toBe(true);
    });

    it("offers only the vendors making the part in the size", () => {
        expect(partVendors(FastenerKind.NUT, "NO_10_32")).toContain(GENERIC);
        expect(partVendors(FastenerKind.NUT, "NO_10_32")).not.toContain("REV");
    });
});

describe("studioConfiguration", () => {
    it("sends what differs from the studio's defaults", () => {
        expect(
            studioConfiguration(FastenerKind.SCREW, {
                ...SCREW,
                length: "IN_1"
            })
        ).toEqual({ length: "IN_1" });
    });
});
