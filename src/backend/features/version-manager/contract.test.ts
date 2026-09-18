import { describe, expect, it } from "vitest";
import { nextVersionName } from "./contract";

describe("nextVersionName", () => {
    it("starts at V1 in a document with no versions of its own", () => {
        expect(nextVersionName([])).toBe("V1");
    });

    it("follows the highest number, not the count", () => {
        expect(nextVersionName(["V1", "V2", "V3"])).toBe("V4");
        // A version deleted from the middle must not hand its number out again.
        expect(nextVersionName(["V1", "V3"])).toBe("V4");
    });

    it("ignores the names Onshape and people give versions", () => {
        expect(nextVersionName(["Start", "Week 3 release", "V2"])).toBe("V3");
        expect(nextVersionName(["Start", "Competition ready"])).toBe("V1");
    });

    it("takes only a bare V and a number", () => {
        // "V2 rev b" is somebody's name that happens to start with one.
        expect(nextVersionName(["V10", "V2 rev b", "Version 20"])).toBe("V11");
    });

    it("reads a name Onshape padded with spaces", () => {
        expect(nextVersionName([" V7 "])).toBe("V8");
    });
});
