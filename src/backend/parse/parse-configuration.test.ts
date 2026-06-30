import { describe, expect, it } from "vitest";
import {
    ConfigurationParameterType,
    QuantityType,
    Unit,
    VisibilityConditionType,
    LogicalOp,
    VisibilityCondition,
    ParameterObj
} from "../../shared/configuration-models";
import { evaluateCondition } from "../../shared/configuration-utils";
import { parseOnshapeConfiguration } from "./parse-configuration";
import { OnshapeConfigurationResponse } from "../onshape-api/types/configuration";

const NONE_CONDITION = {
    btType: "BTParameterVisibilityCondition-177"
} as const;

describe("parseOnshapeConfiguration", () => {
    it("parses ENUM parameter", () => {
        const raw: OnshapeConfigurationResponse = {
            configurationParameters: [
                {
                    btType: ConfigurationParameterType.ENUM,
                    parameterId: "size",
                    parameterName: "Size",
                    defaultValue: "small",
                    visibilityCondition: NONE_CONDITION,
                    options: [
                        { option: "small", optionName: "Small" },
                        { option: "large", optionName: "Large" }
                    ]
                }
            ]
        };
        const result = parseOnshapeConfiguration(raw);

        expect(result.parameters).toHaveLength(1);
        const param = result.parameters[0];
        expect(param.type).toBe(ConfigurationParameterType.ENUM);
        expect(param.id).toBe("size");
        expect(param.name).toBe("Size");
        expect(param.default).toBe("small");
        expect(param.condition).toBeUndefined();
        if (param.type === ConfigurationParameterType.ENUM) {
            expect(param.options).toEqual([
                { id: "small", name: "Small" },
                { id: "large", name: "Large" }
            ]);
            expect(param.optionConditions).toEqual([]);
        }
    });

    it("parses BOOLEAN parameter", () => {
        const raw: OnshapeConfigurationResponse = {
            configurationParameters: [
                {
                    btType: ConfigurationParameterType.BOOLEAN,
                    parameterId: "mirror",
                    parameterName: "Mirror",
                    defaultValue: true,
                    visibilityCondition: NONE_CONDITION
                }
            ]
        };
        const result = parseOnshapeConfiguration(raw);
        const param = result.parameters[0];
        expect(param.type).toBe(ConfigurationParameterType.BOOLEAN);
        expect(param.default).toBe("true");
    });

    it("parses STRING parameter", () => {
        const raw: OnshapeConfigurationResponse = {
            configurationParameters: [
                {
                    btType: ConfigurationParameterType.STRING,
                    parameterId: "label",
                    parameterName: "Label",
                    defaultValue: "hello",
                    visibilityCondition: NONE_CONDITION
                }
            ]
        };
        const result = parseOnshapeConfiguration(raw);
        const param = result.parameters[0];
        expect(param.type).toBe(ConfigurationParameterType.STRING);
        expect(param.default).toBe("hello");
    });

    it("parses QUANTITY parameter (length)", () => {
        const raw: OnshapeConfigurationResponse = {
            configurationParameters: [
                {
                    btType: ConfigurationParameterType.QUANTITY,
                    parameterId: "length",
                    parameterName: "Length",
                    quantityType: QuantityType.LENGTH,
                    visibilityCondition: NONE_CONDITION,
                    rangeAndDefault: {
                        units: Unit.MILLIMETER,
                        defaultValue: 25,
                        minValue: 0,
                        maxValue: 100
                    }
                }
            ]
        };
        const result = parseOnshapeConfiguration(raw);
        const param = result.parameters[0];
        expect(param.type).toBe(ConfigurationParameterType.QUANTITY);
        expect(param.default).toBe("25 mm");
        if (param.type === ConfigurationParameterType.QUANTITY) {
            expect(param.unit).toBe(Unit.MILLIMETER);
            expect(param.defaultValue).toBe(25);
            expect(param.min).toBe(0);
            expect(param.max).toBe(100);
        }
    });

    it("parses QUANTITY parameter (unitless integer)", () => {
        const raw: OnshapeConfigurationResponse = {
            configurationParameters: [
                {
                    btType: ConfigurationParameterType.QUANTITY,
                    parameterId: "count",
                    parameterName: "Count",
                    quantityType: QuantityType.INTEGER,
                    visibilityCondition: NONE_CONDITION,
                    rangeAndDefault: {
                        units: Unit.UNITLESS,
                        defaultValue: 4,
                        minValue: 1,
                        maxValue: 8
                    }
                }
            ]
        };
        const result = parseOnshapeConfiguration(raw);
        const param = result.parameters[0];
        expect(param.default).toBe("4");
    });
});

describe("evaluateCondition", () => {
    const makeEnumParam = (id: string, options: string[]): ParameterObj => ({
        type: ConfigurationParameterType.ENUM,
        id,
        name: id,
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
            type: VisibilityConditionType.ALWAYS_SHOWN
        };
        expect(evaluateCondition(condition, {}, [])).toBe(true);
    });

    it("EQUAL: returns true when value matches", () => {
        const condition = {
            type: VisibilityConditionType.EQUAL as const,
            id: "size",
            value: "large"
        };
        expect(evaluateCondition(condition, { size: "large" }, [])).toBe(true);
    });

    it("EQUAL: returns false when value does not match", () => {
        const condition = {
            type: VisibilityConditionType.EQUAL as const,
            id: "size",
            value: "large"
        };
        expect(evaluateCondition(condition, { size: "small" }, [])).toBe(false);
    });

    it("RANGE: returns true when value is in range", () => {
        const param = makeEnumParam("size", ["xs", "sm", "md", "lg", "xl"]);
        const condition: VisibilityCondition = {
            type: VisibilityConditionType.RANGE,
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
            type: VisibilityConditionType.RANGE,
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
            type: VisibilityConditionType.RANGE,
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
            type: VisibilityConditionType.LOGICAL,
            operation: LogicalOp.AND,
            children: [
                {
                    type: VisibilityConditionType.EQUAL,
                    id: "a",
                    value: "1"
                },
                {
                    type: VisibilityConditionType.EQUAL,
                    id: "b",
                    value: "2"
                }
            ]
        };
        expect(evaluateCondition(condition, { a: "1", b: "2" }, [])).toBe(true);
    });

    it("LOGICAL AND: false when one child does not match", () => {
        const condition: VisibilityCondition = {
            type: VisibilityConditionType.LOGICAL,
            operation: LogicalOp.AND,
            children: [
                {
                    type: VisibilityConditionType.EQUAL,
                    id: "a",
                    value: "1"
                },
                {
                    type: VisibilityConditionType.EQUAL,
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
            type: VisibilityConditionType.LOGICAL,
            operation: LogicalOp.OR,
            children: [
                {
                    type: VisibilityConditionType.EQUAL,
                    id: "a",
                    value: "1"
                },
                {
                    type: VisibilityConditionType.EQUAL,
                    id: "b",
                    value: "2"
                }
            ]
        };
        expect(evaluateCondition(condition, { a: "1", b: "9" }, [])).toBe(true);
    });

    it("LOGICAL OR: false when no children match", () => {
        const condition: VisibilityCondition = {
            type: VisibilityConditionType.LOGICAL,
            operation: LogicalOp.OR,
            children: [
                {
                    type: VisibilityConditionType.EQUAL,
                    id: "a",
                    value: "1"
                },
                {
                    type: VisibilityConditionType.EQUAL,
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
