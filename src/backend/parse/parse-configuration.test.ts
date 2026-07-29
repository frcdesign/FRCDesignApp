import { describe, expect, it } from "vitest";
import {
    OptionVisibilityType,
    ConfigurationParameter,
    ParameterType,
    VisibilityCondition,
    VisibilityType
} from "../../shared/configuration-models";
import {
    LogicalOp,
    QuantityType,
    Unit
} from "../../shared/configuration-enums";
import { evaluateCondition } from "../../shared/configuration-utils";
import { parseOnshapeConfiguration } from "./parse-configuration";
import {
    OnshapeConfigurationResponse,
    OnshapeOptionVisibilityConditionType,
    OnshapeParameterType,
    OnshapeVisibilityConditionType
} from "../onshape-api/onshape-types";

/** No-op visibility condition Onshape attaches to always-visible parameters. */
const NONE = { btType: OnshapeVisibilityConditionType.NONE } as const;

const RESPONSE: OnshapeConfigurationResponse = {
    btType: "BTConfigurationResponse-2019",
    configurationParameters: [
        {
            btType: OnshapeParameterType.BOOLEAN,
            parameterId: "Show_list",
            parameterName: "Show list",
            isCosmetic: true,
            defaultValue: true,
            visibilityCondition: NONE
        },
        {
            btType: OnshapeParameterType.ENUM,
            parameterId: "Vendor",
            parameterName: "Vendor",
            isCosmetic: false,
            defaultValue: "Default",
            options: [
                { option: "Default", optionName: "WCP" },
                { option: "REV", optionName: "REV" }
            ],
            enumOptionVisibilityConditions: { visibilityConditions: [] },
            visibilityCondition: {
                btType: OnshapeVisibilityConditionType.LOGICAL,
                operation: LogicalOp.AND,
                children: [
                    {
                        btType: OnshapeVisibilityConditionType.EQUAL,
                        value: "true",
                        parameterId: "Show_vendor_options"
                    }
                ]
            }
        },
        {
            btType: OnshapeParameterType.ENUM,
            parameterId: "List",
            parameterName: "List",
            isCosmetic: false,
            defaultValue: "WCP_1",
            options: [
                { option: "Default", optionName: "Always shown" },
                { option: "WCP_1", optionName: "WCP 1" },
                { option: "REV_1", optionName: "REV 1" }
            ],
            enumOptionVisibilityConditions: {
                visibilityConditions: [
                    {
                        btType: OnshapeOptionVisibilityConditionType.RANGE,
                        controlledRange: { start: "REV_1", end: "REV_2" },
                        condition: {
                            btType: OnshapeVisibilityConditionType.EQUAL,
                            value: "REV",
                            parameterId: "Vendor"
                        }
                    },
                    {
                        btType: OnshapeOptionVisibilityConditionType.LIST,
                        controlledOptions: ["WCP_1", "WCP_2"],
                        condition: {
                            btType: OnshapeVisibilityConditionType.EQUAL,
                            value: "Default",
                            parameterId: "Vendor"
                        }
                    }
                ]
            },
            // A logical wrapper whose only child is the no-op condition, which the
            // parser drops — exercising the empty-children path.
            visibilityCondition: {
                btType: OnshapeVisibilityConditionType.LOGICAL,
                operation: LogicalOp.AND,
                children: [NONE]
            }
        },
        {
            btType: OnshapeParameterType.QUANTITY,
            parameterId: "TTB_Length",
            parameterName: "TTB Length",
            isCosmetic: false,
            quantityType: QuantityType.LENGTH,
            rangeAndDefault: {
                defaultValue: 1,
                minValue: 0,
                maxValue: 100000,
                units: Unit.INCH
            },
            visibilityCondition: {
                btType: OnshapeVisibilityConditionType.LOGICAL,
                operation: LogicalOp.OR,
                children: [
                    {
                        btType: OnshapeVisibilityConditionType.EQUAL,
                        value: "TTB",
                        parameterId: "Vendor"
                    }
                ]
            }
        }
    ]
};

describe("parseOnshapeConfiguration", () => {
    const parameters = parseOnshapeConfiguration(RESPONSE);

    it("parses every parameter", () => {
        expect(parameters.map((p) => [p.id, p.type])).toEqual([
            ["Show_list", ParameterType.BOOLEAN],
            ["Vendor", ParameterType.ENUM],
            ["List", ParameterType.ENUM],
            ["TTB_Length", ParameterType.QUANTITY]
        ]);
    });

    it("parses a BOOLEAN parameter and its cosmetic flag", () => {
        expect(parameters[0]).toEqual({
            type: ParameterType.BOOLEAN,
            id: "Show_list",
            name: "Show list",
            isCosmetic: true,
            default: "true",
            condition: undefined
        });
    });

    it("parses an ENUM parameter with options and a logical condition", () => {
        const vendor = parameters[1];
        expect(vendor.isCosmetic).toBe(false);
        if (vendor.type !== ParameterType.ENUM)
            throw new Error("expected ENUM");
        expect(vendor.default).toBe("Default");
        expect(vendor.options).toEqual([
            { id: "Default", name: "WCP" },
            { id: "REV", name: "REV" }
        ]);
        expect(vendor.optionConditions).toEqual([]);
        expect(vendor.condition).toEqual({
            type: VisibilityType.LOGICAL,
            operation: LogicalOp.AND,
            children: [
                {
                    type: VisibilityType.EQUAL,
                    id: "Show_vendor_options",
                    value: "true"
                }
            ]
        });
    });

    it("parses enum option visibility conditions (list + range)", () => {
        const list = parameters[2];
        if (list.type !== ParameterType.ENUM) throw new Error("expected ENUM");
        expect(list.optionConditions).toEqual([
            {
                type: OptionVisibilityType.RANGE,
                start: "REV_1",
                end: "REV_2",
                condition: {
                    type: VisibilityType.EQUAL,
                    id: "Vendor",
                    value: "REV"
                }
            },
            {
                type: OptionVisibilityType.LIST,
                controlledOptions: ["WCP_1", "WCP_2"],
                condition: {
                    type: VisibilityType.EQUAL,
                    id: "Vendor",
                    value: "Default"
                }
            }
        ]);
    });

    it("drops no-op children from a logical condition", () => {
        expect(parameters[2].condition).toEqual({
            type: VisibilityType.LOGICAL,
            operation: LogicalOp.AND,
            children: []
        });
    });

    it("parses a QUANTITY parameter with units and range", () => {
        const length = parameters[3];
        if (length.type !== ParameterType.QUANTITY)
            throw new Error("expected QUANTITY");
        expect(length.default).toBe("1 in");
        expect(length.defaultValue).toBe(1);
        expect(length.min).toBe(0);
        expect(length.max).toBe(100000);
        expect(length.unit).toBe(Unit.INCH);
        expect(length.condition).toEqual({
            type: VisibilityType.LOGICAL,
            operation: LogicalOp.OR,
            children: [
                {
                    type: VisibilityType.EQUAL,
                    id: "Vendor",
                    value: "TTB"
                }
            ]
        });
    });
});

describe("evaluateCondition", () => {
    const makeEnumParam = (
        id: string,
        options: string[]
    ): ConfigurationParameter => ({
        type: ParameterType.ENUM,
        id,
        name: id,
        isCosmetic: false,
        default: options[0],
        condition: undefined,
        optionConditions: [],
        options: options.map((option) => ({ id: option, name: option }))
    });

    it("returns true when condition is undefined", () => {
        expect(evaluateCondition(undefined, {}, [])).toBe(true);
    });

    it("ALWAYS_SHOWN: returns true", () => {
        const condition: VisibilityCondition = {
            type: VisibilityType.ALWAYS_SHOWN
        };
        expect(evaluateCondition(condition, {}, [])).toBe(true);
    });

    it("EQUAL: returns true when value matches", () => {
        const condition = {
            type: VisibilityType.EQUAL as const,
            id: "size",
            value: "large"
        };
        expect(evaluateCondition(condition, { size: "large" }, [])).toBe(true);
    });

    it("EQUAL: returns false when value does not match", () => {
        const condition = {
            type: VisibilityType.EQUAL as const,
            id: "size",
            value: "large"
        };
        expect(evaluateCondition(condition, { size: "small" }, [])).toBe(false);
    });

    it("RANGE: returns true when value is in range", () => {
        const param = makeEnumParam("size", ["xs", "sm", "md", "lg", "xl"]);
        const condition: VisibilityCondition = {
            type: VisibilityType.RANGE,
            id: "size",
            start: "sm",
            end: "lg"
        };
        expect(evaluateCondition(condition, { size: "md" }, [param])).toBe(
            true
        );
    });

    it("RANGE: returns false when value is below start", () => {
        const param = makeEnumParam("size", ["xs", "sm", "md", "lg", "xl"]);
        const condition: VisibilityCondition = {
            type: VisibilityType.RANGE,
            id: "size",
            start: "sm",
            end: "lg"
        };
        expect(evaluateCondition(condition, { size: "xs" }, [param])).toBe(
            false
        );
    });

    it("RANGE: returns false when value is above end", () => {
        const param = makeEnumParam("size", ["xs", "sm", "md", "lg", "xl"]);
        const condition: VisibilityCondition = {
            type: VisibilityType.RANGE,
            id: "size",
            start: "sm",
            end: "lg"
        };
        expect(evaluateCondition(condition, { size: "xl" }, [param])).toBe(
            false
        );
    });

    it("LOGICAL AND: true when all children match", () => {
        const condition: VisibilityCondition = {
            type: VisibilityType.LOGICAL,
            operation: LogicalOp.AND,
            children: [
                {
                    type: VisibilityType.EQUAL,
                    id: "a",
                    value: "1"
                },
                {
                    type: VisibilityType.EQUAL,
                    id: "b",
                    value: "2"
                }
            ]
        };
        expect(evaluateCondition(condition, { a: "1", b: "2" }, [])).toBe(true);
    });

    it("LOGICAL AND: false when one child does not match", () => {
        const condition: VisibilityCondition = {
            type: VisibilityType.LOGICAL,
            operation: LogicalOp.AND,
            children: [
                {
                    type: VisibilityType.EQUAL,
                    id: "a",
                    value: "1"
                },
                {
                    type: VisibilityType.EQUAL,
                    id: "b",
                    value: "2"
                }
            ]
        };
        expect(evaluateCondition(condition, { a: "1", b: "9" }, [])).toBe(
            false
        );
    });

    it("LOGICAL OR: true when one child matches", () => {
        const condition: VisibilityCondition = {
            type: VisibilityType.LOGICAL,
            operation: LogicalOp.OR,
            children: [
                {
                    type: VisibilityType.EQUAL,
                    id: "a",
                    value: "1"
                },
                {
                    type: VisibilityType.EQUAL,
                    id: "b",
                    value: "2"
                }
            ]
        };
        expect(evaluateCondition(condition, { a: "1", b: "9" }, [])).toBe(true);
    });

    it("LOGICAL OR: false when no children match", () => {
        const condition: VisibilityCondition = {
            type: VisibilityType.LOGICAL,
            operation: LogicalOp.OR,
            children: [
                {
                    type: VisibilityType.EQUAL,
                    id: "a",
                    value: "1"
                },
                {
                    type: VisibilityType.EQUAL,
                    id: "b",
                    value: "2"
                }
            ]
        };
        expect(evaluateCondition(condition, { a: "9", b: "9" }, [])).toBe(
            false
        );
    });
});
