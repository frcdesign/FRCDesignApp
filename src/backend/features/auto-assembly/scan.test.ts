import { describe, expect, it } from "vitest";
import {
    decodeFeatureScriptValue,
    DETERMINISTIC_ID,
    holeScanLambda,
    parseStudioScan,
    scanScript
} from "./scan";

const number = (value: number) => ({ btType: "BTFSValueNumber-772", value });
const string = (value: string) => ({ btType: "BTFSValueString-1422", value });
const array = (...value: object[]) => ({
    btType: "BTFSValueArray-1499",
    value
});
const map = (entries: Record<string, object>) => ({
    btType: "BTFSValueMap-2062",
    value: Object.entries(entries).map(([key, value]) => ({
        btType: "BTFSValueMapEntry-2077",
        key: string(key),
        value
    }))
});

describe("decodeFeatureScriptValue", () => {
    it("turns maps into objects, and keeps arrays, numbers and booleans", () => {
        expect(
            decodeFeatureScriptValue(
                map({
                    a: array(number(1), number(2)),
                    b: { btType: "BTFSValueBoolean-1195", value: true },
                    c: { btType: "BTFSValueUndefined-2003" }
                })
            )
        ).toEqual({ a: [1, 2], b: true, c: undefined });
    });

    it("reads types by their full Java names, as the evaluation answers", () => {
        const fsvalue = "com.belmonttech.serialize.fsvalue.";
        expect(
            decodeFeatureScriptValue({
                btType: `${fsvalue}BTFSValueMap`,
                value: [
                    {
                        btType: `${fsvalue}BTFSValueMapEntry`,
                        key: {
                            btType: `${fsvalue}BTFSValueString`,
                            value: "a"
                        },
                        value: {
                            btType: `${fsvalue}BTFSValueArray`,
                            value: [
                                {
                                    btType: `${fsvalue}BTFSValueNumber`,
                                    value: 1
                                }
                            ]
                        }
                    }
                ]
            })
        ).toEqual({ a: [1] });
    });
});

describe("parseStudioScan", () => {
    it("reads what the scan returns", () => {
        const hole = map({
            faceId: string("F"),
            edges: array(map({ id: string("E"), at: number(0) })),
            origin: array(number(0), number(0), number(0)),
            direction: array(number(0), number(0), number(1)),
            radius: number(0.0025),
            start: number(0),
            end: number(0.01),
            closedAtStart: { btType: "BTFSValueBoolean-1195", value: false },
            closedAtEnd: { btType: "BTFSValueBoolean-1195", value: true },
            threaded: { btType: "BTFSValueBoolean-1195", value: false }
        });
        const scan = parseStudioScan(
            decodeFeatureScriptValue(
                map({
                    parts: map({ JHD: map({ holes: array(hole) }) }),
                    circles: array()
                })
            )
        );
        expect(scan.parts.JHD.holes[0].closedAtEnd).toBe(true);
        expect(scan.parts.JHD.holes[0].edges).toEqual([{ id: "E", at: 0 }]);
    });
});

describe("scanScript", () => {
    it("passes the picked entities in as transient queries", () => {
        const script = scanScript({ edges: ["JKB", "JKC"], faces: [] });
        expect(script).toContain(
            '"edges" : qUnion([qTransient("JKB"), qTransient("JKC")])'
        );
        expect(script).not.toContain('"faces"');
        expect(
            script.startsWith("function(context is Context, queries is map)")
        ).toBe(true);
    });

    it("passes nothing when nothing's picked", () => {
        expect(scanScript({ edges: [], faces: [] })).toContain(
            "return scan(context, {  });"
        );
    });

    it("only takes ids that can't break out of a string", () => {
        expect(DETERMINISTIC_ID.test("JKB")).toBe(true);
        expect(DETERMINISTIC_ID.test('J"); evil(')).toBe(false);
    });
});

describe("holeScanLambda", () => {
    it("is hole-scan.fs's function body, as a lambda", () => {
        const script = scanScript({ edges: [], faces: [] });
        expect(script).toContain(
            "const scan = function(context is Context, queries is map)\n{\n"
        );
        expect(script).toContain(
            'return { "parts" : parts, "circles" : circles };'
        );
    });

    it("needs the function's signature", () => {
        expect(() => holeScanLambda("export function other() {}\n")).toThrow(
            "fastenerHoleScan"
        );
    });
});
