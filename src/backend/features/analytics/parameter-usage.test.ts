import { describe, expect, it } from "vitest";
import {
    OptionVisibilityType,
    ParameterType,
    VisibilityType,
    type ConfigurationParameter
} from "../configurations/contract";
import { buildParameterUsage, type ValueCount } from "./parameter-usage";
import {
    enumParam,
    quantityParam
} from "../../../__test_utils__/configuration-fixtures";

/** A recorded value, in no branch unless the test names one. */
function count(
    parameterId: string,
    value: string,
    total: number,
    instanceKey = ""
): ValueCount {
    return { parameterId, value, instanceKey, count: total };
}

describe("buildParameterUsage", () => {
    const enumParameter: ConfigurationParameter = {
        type: ParameterType.ENUM,
        id: "size",
        name: "Size",
        default: "medium",
        isCosmetic: false,
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
            [count("size", "large", 7), count("size", "medium", 2)]
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
            [count("removed", "1", 4)]
        );

        expect(usage.map((entry) => entry.parameterId)).toEqual(["size"]);
    });

    it("labels a quantity in its own unit, not the one it is keyed in", () => {
        const [usage] = buildParameterUsage(
            [quantityParam("length")],
            [count("length", "0.0254 m", 5), count("length", "0.0508 m", 2)]
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
                count("size", "s1", 4, "vendor=generic"),
                count("size", "s2", 6, "vendor=wcp")
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

    it("splits an option both branches offer by the branch it was chosen in", () => {
        // The bug this keying exists for: `shared` is offered either way, so
        // its own count says nothing about which vendor was picked with it.
        const vendor = enumParam("vendor", ["generic", "wcp"]);
        const bearing = enumParam(
            "bearing",
            ["shared", "genericOnly", "wcpOnly"],
            {
                optionConditions: [
                    {
                        type: OptionVisibilityType.LIST,
                        controlledOptions: ["genericOnly"],
                        condition: {
                            type: VisibilityType.EQUAL,
                            id: "vendor",
                            value: "generic"
                        }
                    },
                    {
                        type: OptionVisibilityType.LIST,
                        controlledOptions: ["wcpOnly"],
                        condition: {
                            type: VisibilityType.EQUAL,
                            id: "vendor",
                            value: "wcp"
                        }
                    }
                ]
            }
        );

        const [, generic, wcp] = buildParameterUsage(
            [vendor, bearing],
            [
                count("bearing", "shared", 3, "vendor=generic"),
                count("bearing", "shared", 7, "vendor=wcp"),
                count("bearing", "genericOnly", 2, "vendor=generic"),
                count("bearing", "wcpOnly", 5, "vendor=wcp")
            ]
        );

        expect(generic.path).toEqual(["generic"]);
        expect(generic.values).toContainEqual(
            expect.objectContaining({ value: "shared", count: 3 })
        );
        expect(generic.total).toBe(5);

        expect(wcp.path).toEqual(["wcp"]);
        expect(wcp.values).toContainEqual(
            expect.objectContaining({ value: "shared", count: 7 })
        );
        expect(wcp.total).toBe(12);
    });

    it("counts a row from before branches were keyed only where one is not needed", () => {
        const vendor = enumParam("vendor", ["generic", "wcp"]);
        const bearing = enumParam("bearing", ["a", "b"], {
            optionConditions: [
                {
                    type: OptionVisibilityType.LIST,
                    controlledOptions: ["b"],
                    condition: {
                        type: VisibilityType.EQUAL,
                        id: "vendor",
                        value: "wcp"
                    }
                }
            ]
        });

        const [whole, generic, wcp] = buildParameterUsage(
            [vendor, bearing],
            [count("vendor", "wcp", 9), count("bearing", "a", 9)]
        );

        // Nothing conditions the vendor, so its own unkeyed row still counts.
        expect(whole.total).toBe(9);
        // The list is instanced, and a row belonging to no branch cannot be
        // attributed to one. A rebuild from the log is what fills these in.
        expect(generic.total).toBe(0);
        expect(wcp.total).toBe(0);
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
                    default: "none",
                    isCosmetic: false
                }
            ],
            [count("label", "custom", 2)]
        );

        const defaultValue = usage.values.find((value) => value.isDefault);
        expect(defaultValue).toMatchObject({ value: "none", count: 0 });
    });
});
