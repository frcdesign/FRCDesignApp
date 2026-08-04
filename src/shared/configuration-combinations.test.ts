import { describe, expect, it } from "vitest";
import { enumerateConfigurations } from "./configuration-combinations";
import {
    OptionVisibilityType,
    ConfigurationParameter,
    ParameterType,
    QuantityParameter,
    StringParameter,
    VisibilityCondition,
    VisibilityType
} from "./configuration-models";
import { boolParam, enumParam } from "../__test_utils__/configuration-fixtures";
import { QuantityType, Unit } from "./configuration-enums";

function quantityParam(id: string): QuantityParameter {
    return {
        id,
        name: id,
        default: "0",
        isCosmetic: false,
        type: ParameterType.QUANTITY,
        quantityType: QuantityType.LENGTH,
        defaultValue: 0,
        min: 0,
        max: 10,
        unit: Unit.MILLIMETER
    };
}

function stringParam(id: string): StringParameter {
    return {
        id,
        name: id,
        default: "",
        isCosmetic: false,
        type: ParameterType.STRING
    };
}

const equals = (id: string, value: string): VisibilityCondition => ({
    type: VisibilityType.EQUAL,
    id,
    value
});

const alwaysShown: VisibilityCondition = { type: VisibilityType.ALWAYS_SHOWN };

describe("enumerateConfigurations", () => {
    it("produces the cartesian product of enum parameters", () => {
        const params: ConfigurationParameter[] = [
            enumParam("A", ["a1", "a2"]),
            enumParam("B", ["b1", "b2", "b3"])
        ];
        const { configurations, capped } = enumerateConfigurations(params);
        expect(capped).toBe(false);
        expect(configurations).toHaveLength(6);
        expect(configurations).toContainEqual({ A: "a1", B: "b1" });
        expect(configurations).toContainEqual({ A: "a2", B: "b3" });
    });

    it("enumerates both values of a boolean parameter", () => {
        const { configurations } = enumerateConfigurations([boolParam("A")]);
        expect(configurations).toEqual([{ A: "true" }, { A: "false" }]);
    });

    it("ignores quantity and string parameters", () => {
        const params: ConfigurationParameter[] = [
            enumParam("A", ["a1", "a2"]),
            quantityParam("Q"),
            stringParam("S")
        ];
        const { configurations } = enumerateConfigurations(params);
        expect(configurations).toEqual([{ A: "a1" }, { A: "a2" }]);
    });

    it("skips a parameter hidden by its visibility condition", () => {
        const params: ConfigurationParameter[] = [
            boolParam("A"),
            enumParam("B", ["b1", "b2"], { condition: equals("A", "true") })
        ];
        const { configurations } = enumerateConfigurations(params);
        // B only appears when A is true.
        expect(configurations).toContainEqual({ A: "false" });
        expect(configurations).toContainEqual({ A: "true", B: "b1" });
        expect(configurations).toContainEqual({ A: "true", B: "b2" });
        expect(configurations).toHaveLength(3);
    });

    it("prunes enum options hidden by option visibility conditions", () => {
        const params: ConfigurationParameter[] = [
            enumParam("A", ["a1", "a2"]),
            enumParam("B", ["b1", "b2"], {
                optionConditions: [
                    {
                        type: OptionVisibilityType.LIST,
                        controlledOptions: ["b1"],
                        condition: alwaysShown
                    },
                    {
                        type: OptionVisibilityType.LIST,
                        controlledOptions: ["b2"],
                        condition: equals("A", "a2")
                    }
                ]
            })
        ];
        const { configurations } = enumerateConfigurations(params);
        // b2 only visible when A === a2.
        expect(configurations).toContainEqual({ A: "a1", B: "b1" });
        expect(configurations).toContainEqual({ A: "a2", B: "b1" });
        expect(configurations).toContainEqual({ A: "a2", B: "b2" });
        expect(configurations).toHaveLength(3);
    });

    it("caps enumeration and reports it", () => {
        const params: ConfigurationParameter[] = [
            boolParam("A"),
            boolParam("B"),
            boolParam("C")
        ];
        const { configurations, capped } = enumerateConfigurations(params, 4);
        expect(capped).toBe(true);
        expect(configurations).toEqual([]);
    });
});
