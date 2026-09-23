import { describe, expect, it } from "vitest";
import {
    OptionVisibilityType,
    ParameterType,
    VisibilityType,
    type ConfigurationParameter
} from "../configurations/contract";
import { buildParameterUsage } from "./parameter-usage";
import {
    enumParam,
    quantityParam
} from "../../../__test_utils__/configuration-fixtures";

describe("buildParameterUsage", () => {
    const enumParameter: ConfigurationParameter = {
        type: ParameterType.ENUM,
        id: "size",
        name: "Size",
        default: "medium",
        options: [
            { id: "small", name: "Small" },
            { id: "medium", name: "Medium" },
            { id: "large", name: "Large" }
        ],
        optionConditions: []
    };

    it("surfaces declared options that were never picked", () => {
        const [usage] = buildParameterUsage(
            [enumParameter],
            [
                { parameterId: "size", value: "large", count: 7 },
                { parameterId: "size", value: "medium", count: 2 }
            ]
        );

        expect(usage.total).toBe(9);
        const small = usage.values.find((value) => value.value === "small");
        expect(small).toMatchObject({ count: 0, label: "Small" });

        // The default is flagged even though it isn't the popular choice —
        // which is the whole point of the report.
        const medium = usage.values.find((value) => value.value === "medium");
        expect(medium?.isDefault).toBe(true);
        expect(usage.values[0].value).toBe("large");
    });

    it("drops values recorded against a parameter the part no longer has", () => {
        const usage = buildParameterUsage(
            [enumParameter],
            [{ parameterId: "removed", value: "1", count: 4 }]
        );

        expect(usage.map((entry) => entry.parameterId)).toEqual(["size"]);
    });

    it("labels a quantity in its own unit, not the one it is keyed in", () => {
        const [usage] = buildParameterUsage(
            [quantityParam("length")],
            [
                { parameterId: "length", value: "0.0254 m", count: 5 },
                { parameterId: "length", value: "0.0508 m", count: 2 }
            ]
        );

        expect(usage.values).toEqual([
            { value: "0.0254 m", label: "1 in", count: 5, isDefault: true },
            { value: "0.0508 m", label: "2 in", count: 2, isDefault: false }
        ]);
    });

    it("counts each branch of a filtered list against its own options", () => {
        const vendor = enumParam("vendor", ["generic", "wcp"]);
        const size = enumParam("size", ["s1", "s2", "s3"], {
            optionConditions: [
                {
                    type: OptionVisibilityType.LIST,
                    controlledOptions: ["s1"],
                    condition: {
                        type: VisibilityType.EQUAL,
                        id: "vendor",
                        value: "generic"
                    }
                },
                {
                    type: OptionVisibilityType.LIST,
                    controlledOptions: ["s2", "s3"],
                    condition: {
                        type: VisibilityType.EQUAL,
                        id: "vendor",
                        value: "wcp"
                    }
                }
            ]
        });

        const [, generic, wcp] = buildParameterUsage(
            [vendor, size],
            [
                { parameterId: "size", value: "s1", count: 4 },
                { parameterId: "size", value: "s2", count: 6 }
            ]
        );

        expect(generic.path).toEqual(["generic"]);
        expect(generic.total).toBe(4);
        expect(generic.values.map((value) => value.value)).toEqual(["s1"]);

        expect(wcp.path).toEqual(["wcp"]);
        // s3 was never picked, and the branch it belongs to is where it shows.
        expect(wcp.total).toBe(6);
        expect(wcp.values.map((value) => value.value)).toEqual(["s2", "s3"]);
    });

    it("flags the option a branch lands on when the default is not offered", () => {
        const vendor = enumParam("vendor", ["generic", "wcp"]);
        const size = enumParam("size", ["s1", "s2"], {
            // The declared default is s1, which only generic offers.
            optionConditions: [
                {
                    type: OptionVisibilityType.LIST,
                    controlledOptions: ["s1"],
                    condition: {
                        type: VisibilityType.EQUAL,
                        id: "vendor",
                        value: "generic"
                    }
                }
            ]
        });

        const [, generic, wcp] = buildParameterUsage([vendor, size], []);

        expect(
            generic.values.map((value) => [
                value.value,
                value.isDefault,
                value.isImplicitDefault
            ])
        ).toEqual([
            ["s1", true, undefined],
            ["s2", false, undefined]
        ]);
        expect(wcp.values).toEqual([
            {
                value: "s2",
                label: "s2",
                count: 0,
                isDefault: false,
                isImplicitDefault: true
            }
        ]);
    });

    it("always shows a free-form parameter's default, even unused", () => {
        const [usage] = buildParameterUsage(
            [
                {
                    type: ParameterType.STRING,
                    id: "label",
                    name: "Label",
                    default: "none"
                }
            ],
            [{ parameterId: "label", value: "custom", count: 2 }]
        );

        const defaultValue = usage.values.find((value) => value.isDefault);
        expect(defaultValue).toMatchObject({ value: "none", count: 0 });
    });
});
