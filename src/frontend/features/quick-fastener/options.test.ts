import { describe, expect, it } from "vitest";
import {
    DEFAULT_MAX_GAP,
    DEFAULT_MAX_LENGTH,
    DEFAULT_MAX_THREAD_DEPTH,
    FastenerMode,
    HoleEnd,
    HoleStatus,
    StopCondition
} from "@backend/features/quick-fastener/contract";
import {
    FastenerKind,
    GENERIC,
    isMade
} from "@backend/features/quick-fastener/studios";
import {
    type Choices,
    defaultChoices,
    describePlan,
    fastenerOptions,
    Part,
    settleChoices
} from "./options";
import { FormInput } from "./parameters";

function choices(extra: Partial<Choices> = {}): Choices {
    return { ...defaultChoices(), ...extra };
}

describe("settleChoices", () => {
    it("makes the defaults whole: a Generic #10-32 button head with a Generic nylock", () => {
        const options = fastenerOptions(settleChoices(choices()));
        expect(options.screw).toMatchObject({
            vendor: GENERIC,
            size: "NO_10_32",
            head: "BUTTON"
        });
        expect(options.nut).toEqual({
            vendor: GENERIC,
            size: "NO_10_32",
            type: "NYLOCK"
        });
        expect(options.screwWasher).toBeUndefined();
        expect(options.mode).toBe(FastenerMode.AUTOMATIC);
        expect(options.stop).toBe(StopCondition.MAX_LENGTH);
        expect(options.maxLength).toBeCloseTo(DEFAULT_MAX_LENGTH);
        expect(options.maxGap).toBeCloseTo(DEFAULT_MAX_GAP);
        expect(options.maxThreadDepth).toBeCloseTo(DEFAULT_MAX_THREAD_DEPTH);
        expect(isMade(FastenerKind.SCREW, options.screw)).toBe(true);
    });

    it("follows the screw: WCP makes no flat heads, and only #10-32", () => {
        const settled = settleChoices(
            choices({
                screw: { vendor: "WCP", head: "FLAT", size: "QUARTER_20" }
            })
        );
        expect(settled.screw.size).toBe("NO_10_32");
        expect(settled.screw.head).not.toBe("FLAT");
    });

    it("puts each part in the screw's size, from a vendor making it there", () => {
        const settled = settleChoices(
            choices({
                screw: { vendor: "MCMASTER", size: "QUARTER_20" },
                parts: {
                    [Part.SCREW_WASHER]: { vendor: "REV" },
                    [Part.NUT]: { vendor: GENERIC },
                    [Part.NUT_WASHER]: {}
                }
            })
        );
        // REV makes no washers, so the screw's vendor's
        const washer = settled.parts[Part.SCREW_WASHER];
        expect(washer).toMatchObject({
            vendor: "MCMASTER",
            size: "QUARTER_20"
        });
        expect(washer && isMade(FastenerKind.WASHER, washer)).toBe(true);
        expect(settled.parts[Part.NUT]).toMatchObject({
            vendor: GENERIC,
            size: "QUARTER_20"
        });
    });

    it("leaves the screw washer out under a flat head, and the nut washer without a nut", () => {
        const settled = settleChoices(
            choices({
                screw: { head: "FLAT" },
                added: {
                    [Part.SCREW_WASHER]: true,
                    [Part.NUT]: false,
                    [Part.NUT_WASHER]: true
                }
            })
        );
        const options = fastenerOptions(settled);
        expect(options.screwWasher).toBeUndefined();
        expect(options.nut).toBeUndefined();
        expect(options.nutWasher).toBeUndefined();
    });

    it("sends the quantities typed, in metres", () => {
        const options = fastenerOptions(
            settleChoices(
                choices({
                    form: {
                        [FormInput.STOP]: StopCondition.FIRST_GAP,
                        [FormInput.MAX_GAP]: "(1 + 1) / 16 in"
                    }
                })
            )
        );
        expect(options.stop).toBe(StopCondition.FIRST_GAP);
        expect(options.maxGap).toBeCloseTo(0.125 * 0.0254);
    });
});

describe("describePlan", () => {
    it("names the screw and its nut", () => {
        expect(
            describePlan({
                key: "k",
                status: HoleStatus.READY,
                end: HoleEnd.THROUGH,
                screw: {
                    vendor: GENERIC,
                    size: "NO_10_32",
                    head: "BUTTON",
                    length: "IN_0_875",
                    variant: "STANDARD"
                },
                nut: { vendor: GENERIC, size: "NO_10_32", type: "NYLOCK" }
            })
        ).toBe("#10-32 x 7/8 in. Button head, Nylock nut");
    });

    it("says why a hole gets nothing", () => {
        expect(
            describePlan({
                key: "k",
                status: HoleStatus.NO_FIT,
                reason: "No screw fits."
            })
        ).toBe("No screw fits.");
    });
});
