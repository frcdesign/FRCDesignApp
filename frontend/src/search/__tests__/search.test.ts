import { processTerm, tokenize } from "../search";

describe("processTerm", () => {
    it("should process camelCase", () => {
        const result = processTerm("MAXSpline");
        expect(result).toEqual(
            expect.arrayContaining(["max", "spline", "maxspline"])
        );
    });

    it("should process CapitalCase", () => {
        const result = processTerm("MaxSpline");
        expect(result).toEqual(
            expect.arrayContaining(["max", "spline", "maxspline"])
        );
    });
});

describe("tokenize", () => {
    it("should strip punctuation", () => {
        const result = tokenize('1" Linear (REV)');
        expect(result).toEqual(["1", "Linear", "REV"]);
    });

    it("should strip punctuation", () => {
        const result = tokenize("10-32 Bearings & Bushings #X-Contact");
        expect(result).toEqual([
            "10",
            "32",
            "Bearings",
            "Bushings",
            "X",
            "Contact"
        ]);
    });
});
