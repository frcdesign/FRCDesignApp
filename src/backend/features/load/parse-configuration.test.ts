import { describe, expect, it } from "vitest";
import {
    OptionVisibilityType,
    ParameterType,
    Selection,
    VisibilityCondition,
    VisibilityType
} from "../configurations/models";
import { enumParam } from "../../../__test_utils__/configuration-fixtures";
import { LogicalOp, QuantityType, Unit } from "../configurations/enums";
import { evaluateCondition } from "../configurations/utils";
import { parseOnshapeConfiguration } from "./parse-configuration";
import {
    OnshapeConfigurationResponse,
    OnshapeOptionVisibilityConditionType,
    OnshapeParameterType,
    OnshapeVisibilityConditionType
} from "../../lib/onshape/types";

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
        // Canonical, like every value it will be compared against; the
        // numeric form below is what the input seeds its display from.
        expect(length.default).toBe("0.0254 m");
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
    const sizes = enumParam("size", ["xs", "sm", "md", "lg", "xl"]);
    const equals = (id: string, value: string): VisibilityCondition => ({
        type: VisibilityType.EQUAL,
        id,
        value
    });
    /** `a=1` and `b=2`, joined by the operation under test. */
    const bothOf = (operation: LogicalOp): VisibilityCondition => ({
        type: VisibilityType.LOGICAL,
        operation,
        children: [equals("a", "1"), equals("b", "2")]
    });
    const smToLg: VisibilityCondition = {
        type: VisibilityType.RANGE,
        id: "size",
        start: "sm",
        end: "lg"
    };

    const cases: [
        string,
        VisibilityCondition | undefined,
        Selection,
        boolean
    ][] = [
        ["no condition", undefined, {}, true],
        ["always shown", { type: VisibilityType.ALWAYS_SHOWN }, {}, true],
        ["equal, matching", equals("size", "lg"), { size: "lg" }, true],
        ["equal, differing", equals("size", "lg"), { size: "sm" }, false],
        ["range, inside", smToLg, { size: "md" }, true],
        ["range, below start", smToLg, { size: "xs" }, false],
        ["range, above end", smToLg, { size: "xl" }, false],
        ["and, both matching", bothOf(LogicalOp.AND), { a: "1", b: "2" }, true],
        [
            "and, one differing",
            bothOf(LogicalOp.AND),
            { a: "1", b: "9" },
            false
        ],
        ["or, one matching", bothOf(LogicalOp.OR), { a: "1", b: "9" }, true],
        ["or, none matching", bothOf(LogicalOp.OR), { a: "9", b: "9" }, false]
    ];

    it.each(cases)("%s", (_name, condition, configuration, expected) => {
        expect(evaluateCondition(condition, configuration, [sizes])).toBe(
            expected
        );
    });
});
