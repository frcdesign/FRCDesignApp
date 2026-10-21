import { describe, expect, it } from "vitest";
import {
    FastenerMode,
    HoleEnd,
    HoleStatus
} from "@backend/features/quick-fastener/contract";
import { consistentOptions, defaultOptions, describePlan } from "./options";

describe("consistentOptions", () => {
    it("keeps the defaults as they are", () => {
        expect(consistentOptions(defaultOptions())).toEqual(defaultOptions());
    });

    it("follows the vendor: WCP makes no flat heads, and only #10-32", () => {
        const options = consistentOptions({
            ...defaultOptions(),
            mode: FastenerMode.PRESET,
            vendor: "WCP",
            head: "FLAT",
            size: "QUARTER_20"
        });
        expect(options.size).toBe("NO_10_32");
        expect(options.head).toBe("SOCKET");
    });

    it("keeps a length only where it's made", () => {
        const options = consistentOptions({
            ...defaultOptions(),
            mode: FastenerMode.PRESET,
            vendor: "REV",
            length: "IN_0_875"
        });
        // REV makes no 7/8 in. button head; its shortest is 1/4 in.
        expect(options.length).toBe("IN_0_25");
    });

    it("takes the washer out from under a flat head, and from under no nut", () => {
        const options = consistentOptions({
            ...defaultOptions(),
            head: "FLAT",
            headWasher: true,
            nutType: undefined,
            nutWasher: true
        });
        expect(options.headWasher).toBe(false);
        expect(options.nutWasher).toBe(false);
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
                    vendor: "GENERIC",
                    size: "NO_10_32",
                    head: "BUTTON",
                    length: "IN_0_875",
                    washer: false
                },
                nut: {
                    vendor: "GENERIC",
                    size: "NO_10_32",
                    type: "NYLOCK",
                    washer: false
                }
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
