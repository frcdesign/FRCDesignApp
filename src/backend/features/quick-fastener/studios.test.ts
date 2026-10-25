import { describe, expect, it } from "vitest";
import { ParameterType } from "../configurations/contract";
import { FASTENER_SET } from "../../../__test_utils__/fastener-set";
import { getVisibleOptions } from "../configurations/utils";
import {
    FastenerKind,
    GENERIC,
    isMade,
    partVendors,
    settlePart,
    settleScrew,
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
        const parameters = FASTENER_SET.studios[FastenerKind.SCREW].parameters;
        expect(parameters.map((parameter) => parameter.id)).toEqual([
            "vendor",
            "size",
            "head",
            "finish",
            "length",
            "fullyThreaded"
        ]);
        const [vendor, , , , length, fullyThreaded] = parameters;
        expect(vendor.default).toBe(GENERIC);
        expect(length.type).toBe(ParameterType.ENUM);
        expect(length.default).toBe("IN_0_375");
        expect(fullyThreaded.type).toBe(ParameterType.ENUM);
        // McMaster-Carr makes every nut, so the nut's studio has no vendor
        expect(
            FASTENER_SET.studios[FastenerKind.NUT].parameters.map(
                (parameter) => parameter.id
            )
        ).toEqual(["size", "type"]);
    });

    it("offers Fully threaded only where a length is sold both ways", () => {
        const parameters = FASTENER_SET.studios[FastenerKind.SCREW].parameters;
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
        expect(settleScrew(FASTENER_SET, SCREW)).toEqual(SCREW);
        // WCP makes no flat heads, and only #10-32
        const wcp = settleScrew(FASTENER_SET, {
            ...SCREW,
            vendor: "WCP",
            size: "QUARTER_20",
            head: "FLAT"
        });
        expect(wcp.size).toBe("NO_10_32");
        expect(wcp.head).not.toBe("FLAT");
        expect(isMade(FASTENER_SET, FastenerKind.SCREW, wcp)).toBe(true);
    });
});

describe("settlePart", () => {
    it("is Generic under a Generic screw, whatever was chosen", () => {
        expect(
            settlePart(
                FASTENER_SET,
                FastenerKind.WASHER,
                { vendor: "MCMASTER", type: "OD_7_16_X_0_03" },
                SCREW
            )
        ).toEqual({
            vendor: GENERIC,
            size: "NO_10_32",
            type: "OD_1_2_X_0_049",
            finish: "BLACK"
        });
    });

    it("keeps the vendor chosen under another vendor's screw, where it makes the part", () => {
        const rev = { vendor: "REV", size: "NO_10_32" };
        expect(
            settlePart(
                FASTENER_SET,
                FastenerKind.WASHER,
                { vendor: "WCP" },
                rev
            )?.vendor
        ).toBe("WCP");
        // REV makes no washers, so Generic's
        expect(
            settlePart(FASTENER_SET, FastenerKind.WASHER, {}, rev)?.vendor
        ).toBe(GENERIC);
    });

    it("takes a nut from the one vendor making nuts, whatever was chosen", () => {
        expect(
            settlePart(
                FASTENER_SET,
                FastenerKind.NUT,
                { vendor: GENERIC },
                SCREW
            )
        ).toEqual({ vendor: "MCMASTER", size: "NO_10_32", type: "NYLOCK" });
    });

    it("resolves a hidden input to the one option made", () => {
        // WCP's #10 washers are black alone, so its Finish is hidden at the default, stainless
        const washer = settlePart(
            FASTENER_SET,
            FastenerKind.WASHER,
            { type: "OD_3_8_X_0_031" },
            { vendor: "WCP", size: "NO_10_32" }
        );
        expect(washer?.finish).toBe("BLACK");
        expect(
            washer && isMade(FASTENER_SET, FastenerKind.WASHER, washer)
        ).toBe(true);
    });

    it("takes the screw's size, and a type made in it", () => {
        const washer = settlePart(
            FASTENER_SET,
            FastenerKind.WASHER,
            { type: "OD_1_2_X_0_049" },
            { vendor: "MCMASTER", size: "QUARTER_20" }
        );
        expect(washer?.size).toBe("QUARTER_20");
        expect(
            washer && isMade(FASTENER_SET, FastenerKind.WASHER, washer)
        ).toBe(true);
    });

    it("offers only the vendors making the part in the size", () => {
        expect(partVendors(FASTENER_SET, FastenerKind.NUT, "NO_10_32")).toEqual(
            ["MCMASTER"]
        );
        expect(
            partVendors(FASTENER_SET, FastenerKind.WASHER, "NO_6_32")
        ).toEqual([GENERIC, "MCMASTER", "ANDYMARK"]);
    });
});

describe("studioConfiguration", () => {
    it("sends what differs from the studio's defaults", () => {
        expect(
            studioConfiguration(FASTENER_SET, FastenerKind.SCREW, {
                ...SCREW,
                length: "IN_1"
            })
        ).toEqual({ length: "IN_1" });
    });
});
