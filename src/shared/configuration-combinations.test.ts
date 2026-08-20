import { describe, expect, it } from "vitest";
import {
    AUTO_INDEX_THRESHOLD,
    countConfigurations,
    enumerateConfigurations,
    IndexingBand,
    isIndexedParameter,
    isIndexingEnabled,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "./configuration-combinations";
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

    it("ignores cosmetic parameters", () => {
        const params: ConfigurationParameter[] = [
            enumParam("A", ["a1", "a2"]),
            enumParam("C", ["c1", "c2"], { isCosmetic: true }),
            boolParam("B")
        ];
        const { configurations } = enumerateConfigurations(params);
        // C ("exclude from properties") rides its default, so only A and B vary.
        expect(configurations).toHaveLength(4);
        expect(configurations.every((c) => !("C" in c))).toBe(true);
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

describe("countConfigurations", () => {
    /** A single enum whose N options enumerate to N configurations. */
    function paramsWithConfigs(count: number): ConfigurationParameter[] {
        return [
            enumParam(
                "A",
                Array.from({ length: count }, (_, i) => `o${i}`)
            )
        ];
    }

    it("counts an insertable with nothing to vary as having none", () => {
        expect(countConfigurations([])).toMatchObject({
            count: 0,
            band: IndexingBand.AUTOMATIC
        });
    });

    // Cosmetic and quantity parameters ride their defaults rather than
    // multiplying the count, so they leave nothing to vary either.
    it("ignores parameters that don't vary the build", () => {
        const cosmetic = { ...enumParam("A", ["x", "y"]), isCosmetic: true };
        expect(countConfigurations([cosmetic])).toMatchObject({
            count: 0,
            band: IndexingBand.AUTOMATIC
        });
    });

    it.each([
        { configs: AUTO_INDEX_THRESHOLD - 1, band: IndexingBand.AUTOMATIC },
        { configs: AUTO_INDEX_THRESHOLD, band: IndexingBand.MANUAL },
        {
            configs: MAX_PART_NUMBER_CONFIGURATIONS,
            band: IndexingBand.MANUAL
        }
    ])(
        "puts $configs configurations in the $band band",
        ({ configs, band }) => {
            expect(
                countConfigurations(paramsWithConfigs(configs))
            ).toMatchObject({
                count: configs,
                band
            });
        }
    );

    it("reports no count past the cap, where enumeration stops", () => {
        expect(
            countConfigurations(
                paramsWithConfigs(MAX_PART_NUMBER_CONFIGURATIONS + 1)
            )
        ).toMatchObject({ count: null, band: IndexingBand.EXCEEDED });
    });
});

describe("isIndexingEnabled", () => {
    it.each([
        // Any non-custom insertable under the threshold indexes without being
        // asked — including one whose vendor the heuristic never recognized.
        { custom: false, band: IndexingBand.AUTOMATIC, force: false, on: true },
        // A custom part never does, until an admin says so.
        { custom: true, band: IndexingBand.AUTOMATIC, force: false, on: false },
        { custom: true, band: IndexingBand.AUTOMATIC, force: true, on: true },
        // Past the threshold it waits to be enabled, custom or not.
        { custom: false, band: IndexingBand.MANUAL, force: false, on: false },
        { custom: false, band: IndexingBand.MANUAL, force: true, on: true },
        { custom: true, band: IndexingBand.MANUAL, force: false, on: false },
        // Past the cap there is nothing to enumerate, so enabling changes nothing.
        { custom: false, band: IndexingBand.EXCEEDED, force: true, on: false },
        { custom: false, band: IndexingBand.EXCEEDED, force: false, on: false }
    ])(
        "custom=$custom band=$band force=$force -> $on",
        ({ custom, band, force, on }) => {
            expect(isIndexingEnabled(custom, band, force)).toBe(on);
        }
    );
});

describe("isIndexedParameter", () => {
    it("varies enum and boolean parameters", () => {
        expect(isIndexedParameter(enumParam("a", ["x", "y"]))).toBe(true);
        expect(isIndexedParameter(boolParam("b"))).toBe(true);
    });

    it("never varies quantity or text parameters", () => {
        expect(isIndexedParameter(quantityParam("q"))).toBe(false);
        const text: StringParameter = {
            id: "s",
            name: "s",
            default: "",
            isCosmetic: false,
            type: ParameterType.STRING
        };
        expect(isIndexedParameter(text)).toBe(false);
    });

    it("does not vary a parameter excluded from properties", () => {
        expect(
            isIndexedParameter(enumParam("a", ["x", "y"], { isCosmetic: true }))
        ).toBe(false);
    });

    // The card reports indexing off this helper, so it has to describe exactly
    // what enumeration varies.
    it("matches the keys enumeration actually varies", () => {
        const parameters = [
            enumParam("varied", ["x", "y"]),
            boolParam("flag"),
            enumParam("cosmetic", ["x", "y"], { isCosmetic: true }),
            quantityParam("length")
        ];
        const { configurations } = enumerateConfigurations(parameters);
        const enumeratedKeys = new Set(
            configurations.flatMap((configuration) =>
                Object.keys(configuration)
            )
        );
        expect([...enumeratedKeys].sort()).toEqual(
            parameters
                .filter(isIndexedParameter)
                .map((parameter) => parameter.id)
                .sort()
        );
    });
});
