import { describe, expect, it } from "vitest";
import {
    type ConfigurationParameter,
    ParameterType
} from "../../configurations/contract";
import { toSelection } from "../../configurations/selection";
import { partName, type StoredParts } from "./part-name";

const LENGTH: ConfigurationParameter = {
    type: ParameterType.ENUM,
    id: "length",
    name: "Length",
    default: "IN_1",
    options: [
        { id: "IN_1", name: "1 in" },
        { id: "IN_2", name: "2 in" },
        { id: "IN_3", name: "3 in" }
    ],
    optionConditions: []
};

/** One part, as a probe reads it. */
const PART = { hasMultipleParts: false, isOpenComposite: false };

const STORED: StoredParts = {
    tabName: "Screw",
    partMetadata: { ...PART, name: "#10-32 x 1 in Button Head Screw" },
    records: [
        {
            ...PART,
            values: { length: "IN_2" },
            name: "#10-32 x 2 in Button Head Screw"
        }
    ],
    parameters: [LENGTH]
};

const selected = (length: string) => toSelection({ length }, STORED.parameters);

describe("partName", () => {
    it("names a configuration as its indexed record does", () => {
        expect(partName(STORED, selected("IN_2"))).toBe(
            "#10-32 x 2 in Button Head Screw"
        );
    });

    it("names the defaults as the element's own part", () => {
        expect(partName(STORED, selected("IN_1"))).toBe(
            "#10-32 x 1 in Button Head Screw"
        );
        expect(partName(STORED, undefined)).toBe(
            "#10-32 x 1 in Button Head Screw"
        );
    });

    it("names a configuration by a generated record leaving out an input with one option", () => {
        const finish: ConfigurationParameter = {
            type: ParameterType.ENUM,
            id: "finish",
            name: "Finish",
            default: "STAINLESS",
            options: [
                { id: "BLACK", name: "Black" },
                { id: "STAINLESS", name: "Stainless" }
            ],
            optionConditions: []
        };
        // Made only in black at 2 in, so its record doesn't name the finish
        const stored: StoredParts = {
            ...STORED,
            parameters: [LENGTH, finish],
            records: [
                {
                    ...PART,
                    values: { length: "IN_2" },
                    name: "2 in, black"
                },
                {
                    ...PART,
                    values: { length: "IN_3", finish: "BLACK" },
                    name: "3 in, black"
                },
                {
                    ...PART,
                    values: { length: "IN_3", finish: "STAINLESS" },
                    name: "3 in, stainless"
                }
            ]
        };
        const choose = (values: Record<string, string>) =>
            partName(stored, toSelection(values, stored.parameters));

        expect(choose({ length: "IN_2", finish: "BLACK" })).toBe("2 in, black");
        expect(choose({ length: "IN_3", finish: "BLACK" })).toBe("3 in, black");
        expect(choose({ length: "IN_3" })).toBe("3 in, stainless");
    });

    it("falls back to the tab's name for a configuration nothing indexed", () => {
        expect(partName(STORED, selected("IN_3"))).toBe("Screw");
        expect(
            partName({ ...STORED, partMetadata: null }, selected("IN_1"))
        ).toBe("Screw");
    });
});
