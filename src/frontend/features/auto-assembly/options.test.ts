import { describe, expect, it } from "vitest";
import { FASTENER_SET } from "../../../__test_utils__/fastener-set";
import {
    DEFAULT_MAX_GAP,
    DEFAULT_MAX_LENGTH,
    DEFAULT_MAX_THREAD_DEPTH,
    FastenerMode,
    StopCondition
} from "@backend/features/auto-assembly/contract";
import {
    FastenerKind,
    GENERIC,
    isMade
} from "@backend/features/auto-assembly/studios";
import {
    type Choices,
    defaultChoices,
    fastenerOptions,
    Part,
    settleChoices
} from "./options";
import { FormInput } from "./parameters";

function choices(extra: Partial<Choices> = {}): Choices {
    return { ...defaultChoices(), ...extra };
}

describe("settleChoices", () => {
    it("makes the defaults whole: a Generic #10-32 button head with McMaster-Carr's nylock", () => {
        const options = fastenerOptions(settleChoices(FASTENER_SET, choices()));
        expect(options.screw).toMatchObject({
            vendor: GENERIC,
            size: "NO_10_32",
            head: "BUTTON"
        });
        expect(options.nut).toEqual({
            vendor: "MCMASTER",
            size: "NO_10_32",
            type: "NYLOCK"
        });
        expect(options.screwWasher).toBeUndefined();
        expect(options.mode).toBe(FastenerMode.AUTOMATIC);
        expect(options.stop).toBe(StopCondition.MAX_LENGTH);
        expect(options.maxLength).toBeCloseTo(DEFAULT_MAX_LENGTH);
        expect(options.maxGap).toBeCloseTo(DEFAULT_MAX_GAP);
        expect(options.maxThreadDepth).toBeCloseTo(DEFAULT_MAX_THREAD_DEPTH);
        expect(isMade(FASTENER_SET, FastenerKind.SCREW, options.screw)).toBe(
            true
        );
    });

    it("follows the screw: WCP makes no flat heads, and only #10-32", () => {
        const settled = settleChoices(
            FASTENER_SET,
            choices({
                screw: { vendor: "WCP", head: "FLAT", size: "QUARTER_20" }
            })
        );
        expect(settled.screw.size).toBe("NO_10_32");
        expect(settled.screw.head).not.toBe("FLAT");
    });

    it("puts each part in the screw's size, from a vendor making it there", () => {
        const settled = settleChoices(
            FASTENER_SET,
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
        expect(
            washer && isMade(FASTENER_SET, FastenerKind.WASHER, washer)
        ).toBe(true);
        // McMaster-Carr makes every nut
        expect(settled.parts[Part.NUT]).toMatchObject({
            vendor: "MCMASTER",
            size: "QUARTER_20"
        });
    });

    it("leaves the screw washer out under a flat head, and the nut washer without a nut", () => {
        const settled = settleChoices(
            FASTENER_SET,
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
                FASTENER_SET,
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
