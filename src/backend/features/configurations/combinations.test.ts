import { describe, expect, it } from "vitest";
import {
    AUTO_INDEX_THRESHOLD,
    countCombinations,
    countConfigurations,
    enumerateConfigurations,
    IndexingBand,
    isIndexedParameter,
    isIndexingEnabled,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "./combinations";
import {
    OptionVisibilityType,
    ConfigurationParameter,
    ParameterRole,
    VisibilityCondition,
    VisibilityType
} from "./contract";
import {
    boolParam,
    enumParam,
    paramsWithConfigs,
    quantityParam,
    stringParam
} from "../../../__test_utils__/configuration-fixtures";

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

    it("leaves an excluded parameter at its default", () => {
        const params: ConfigurationParameter[] = [
            enumParam("A", ["a1", "a2"]),
            enumParam("C", ["c1", "c2"]),
            boolParam("B")
        ];
        const { configurations } = enumerateConfigurations(params, ["C"]);
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
        const { configurations, capped } = enumerateConfigurations(
            params,
            [],
            4
        );
        expect(capped).toBe(true);
        expect(configurations).toEqual([]);
    });
});

describe("countConfigurations", () => {
    it("counts an insertable with nothing to vary as having none", () => {
        expect(countConfigurations([])).toMatchObject({
            count: 0,
            band: IndexingBand.AUTOMATIC
        });
    });

    it("counts an excluded parameter as varying nothing", () => {
        const excluded = enumParam("A", ["x", "y"]);
        expect(countConfigurations([excluded], ["A"])).toMatchObject({
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
        const counted = countConfigurations(
            paramsWithConfigs(MAX_PART_NUMBER_CONFIGURATIONS + 1)
        );
        expect(counted.count).toBeUndefined();
        expect(counted.band).toBe(IndexingBand.EXCEEDED);
    });
});

describe("countCombinations", () => {
    it("counts an insertable with nothing to vary as having none", () => {
        expect(countCombinations([])).toBe(0);
        expect(countCombinations([enumParam("A", ["x", "y"])], ["A"])).toBe(0);
    });

    it("agrees with countConfigurations under the index cap", () => {
        for (const configs of [2, 7, AUTO_INDEX_THRESHOLD, 500]) {
            const params = paramsWithConfigs(configs);
            expect(countCombinations(params)).toBe(
                countConfigurations(params).count
            );
        }
    });

    it("counts on past the index cap, which countConfigurations stops at", () => {
        const params = paramsWithConfigs(MAX_PART_NUMBER_CONFIGURATIONS * 4);
        expect(countConfigurations(params).count).toBeUndefined();
        expect(countCombinations(params)).toBe(
            MAX_PART_NUMBER_CONFIGURATIONS * 4
        );
    });

    it("skips values a visibility condition hides, as enumeration does", () => {
        const params: ConfigurationParameter[] = [
            enumParam("A", ["a1", "a2"]),
            {
                ...enumParam("B", ["b1", "b2", "b3"]),
                condition: equals("A", "a1")
            }
        ];
        expect(countCombinations(params)).toBe(
            enumerateConfigurations(params).configurations.length
        );
    });

    it("gives up past its own cap rather than counting forever", () => {
        expect(
            countCombinations(paramsWithConfigs(64), [], 32)
        ).toBeUndefined();
    });
});

describe("isIndexingEnabled", () => {
    it.each([
        // Under the threshold everything indexes, custom included: a part with
        // no part number is a normal record, not a reason to skip it.
        { band: IndexingBand.AUTOMATIC, force: false, on: true },
        { band: IndexingBand.AUTOMATIC, force: true, on: true },
        // Past the threshold it waits to be enabled.
        { band: IndexingBand.MANUAL, force: false, on: false },
        { band: IndexingBand.MANUAL, force: true, on: true },
        // Past the cap there is nothing to enumerate, so enabling changes nothing.
        { band: IndexingBand.EXCEEDED, force: true, on: false },
        { band: IndexingBand.EXCEEDED, force: false, on: false }
    ])("band=$band force=$force -> $on", ({ band, force, on }) => {
        expect(isIndexingEnabled(band, force)).toBe(on);
    });
});

describe("isIndexedParameter", () => {
    it("varies enum and boolean parameters", () => {
        expect(isIndexedParameter(enumParam("a", ["x", "y"]))).toBe(true);
        expect(isIndexedParameter(boolParam("b"))).toBe(true);
    });

    it("never varies quantity or text parameters", () => {
        expect(isIndexedParameter(quantityParam("q"))).toBe(false);
        expect(isIndexedParameter(stringParam("s"))).toBe(false);
    });

    it("does not vary a parameter an admin excluded", () => {
        expect(isIndexedParameter(enumParam("a", ["x", "y"]), ["a"])).toBe(
            false
        );
    });

    // A role says how a part is drawn or derived, never which part it is.
    it("never varies a parameter with a role", () => {
        const color = {
            ...enumParam("p", ["x", "y"]),
            role: ParameterRole.COLOR
        };
        expect(isIndexedParameter(color)).toBe(false);
    });

    // The card reports indexing off this helper, so it has to describe exactly
    // what enumeration varies.
    it("matches the keys enumeration actually varies", () => {
        const parameters = [
            enumParam("varied", ["x", "y"]),
            boolParam("flag"),
            enumParam("excluded", ["x", "y"]),
            { ...boolParam("color"), role: ParameterRole.COLOR },
            quantityParam("length")
        ];
        const excluded = ["excluded"];
        const { configurations } = enumerateConfigurations(
            parameters,
            excluded
        );
        const enumeratedKeys = new Set(
            configurations.flatMap((configuration) =>
                Object.keys(configuration)
            )
        );
        expect([...enumeratedKeys].sort()).toEqual(
            parameters
                .filter((parameter) => isIndexedParameter(parameter, excluded))
                .map((parameter) => parameter.id)
                .sort()
        );
    });
});
