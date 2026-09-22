import { describe, expect, it } from "vitest";
import {
    OptionVisibilityType,
    VisibilityType,
    type ConfigurationParameter,
    type EnumParameter
} from "./contract";
import { toParameterInstances } from "./instances";
import {
    boolParam,
    enumParam,
    quantityParam
} from "../../../__test_utils__/configuration-fixtures";

/** An option condition naming the options it controls. */
function shownWhen(
    controlledOptions: string[],
    id: string,
    value: string
): EnumParameter["optionConditions"][number] {
    return {
        type: OptionVisibilityType.LIST,
        controlledOptions,
        condition: { type: VisibilityType.EQUAL, id, value }
    };
}

/** Every instance as "path › name", which is what the report shows. */
function labels(parameters: ConfigurationParameter[]): string[] {
    return toParameterInstances(parameters).map((instance) =>
        [
            ...instance.path.map((step) => step.label),
            instance.parameter.name
        ].join(" › ")
    );
}

describe("toParameterInstances", () => {
    const vendor = enumParam("vendor", ["generic", "wcp"]);

    it("leaves a parameter nothing conditions as one instance with no path", () => {
        const instances = toParameterInstances([vendor]);

        expect(instances).toHaveLength(1);
        expect(instances[0].path).toEqual([]);
        expect(instances[0].options).toEqual(vendor.options);
    });

    it("splits a list into one instance per choice that filters it", () => {
        const size = enumParam("size", ["s1", "s2", "s3"], {
            optionConditions: [
                shownWhen(["s1"], "vendor", "generic"),
                shownWhen(["s2", "s3"], "vendor", "wcp")
            ]
        });

        const instances = toParameterInstances([vendor, size]);

        expect(labels([vendor, size])).toEqual([
            "vendor",
            "generic › size",
            "wcp › size"
        ]);
        expect(instances[1].options.map((option) => option.id)).toEqual(["s1"]);
        expect(instances[2].options.map((option) => option.id)).toEqual([
            "s2",
            "s3"
        ]);
    });

    it("merges the choices that leave the same list", () => {
        const wide = enumParam("vendor", ["generic", "wcp", "rev"]);
        // s2 is named by no condition, so every vendor offers it.
        const size = enumParam("size", ["s1", "s2"], {
            optionConditions: [shownWhen(["s1"], "vendor", "generic")]
        });

        expect(labels([wide, size])).toEqual([
            "vendor",
            "generic › size",
            "wcp or rev › size"
        ]);
    });

    it("names the choice a conditioned parameter is shown under", () => {
        const length = quantityParam("length", {
            condition: {
                type: VisibilityType.EQUAL,
                id: "vendor",
                value: "wcp"
            }
        });

        expect(labels([vendor, length])).toEqual(["vendor", "wcp › length"]);
    });

    it("names every choice on the way, and only the ones that discriminate", () => {
        const series = enumParam("series", ["old", "new"]);
        const gated = enumParam("vendor", ["generic", "wcp"], {
            optionConditions: [shownWhen(["wcp"], "series", "new")]
        });
        const size = enumParam("size", ["s1", "s2"], {
            optionConditions: [shownWhen(["s2"], "vendor", "wcp")]
        });

        // Both series leave a generic part the same list, so the series is not
        // what decides it and is left off that path.
        expect(labels([series, gated, size])).toEqual([
            "series",
            "old › vendor",
            "new › vendor",
            "generic › size",
            "new › wcp › size"
        ]);
    });

    it("names a checkbox by its own name and the state it is in", () => {
        // A checkbox has no option names to borrow, so "true" on its own would
        // say nothing about which checkbox it is.
        const hub = boolParam("hub");
        const style = enumParam("style", ["plain", "splined"], {
            optionConditions: [shownWhen(["splined"], "hub", "true")]
        });

        // Checked first, which is the order combinations are enumerated in.
        expect(labels([hub, style])).toEqual([
            "hub",
            "hub: Yes › style",
            "hub: No › style"
        ]);
    });

    it("names both choices when a checkbox and a list each narrow the options", () => {
        const vendor = enumParam("vendor", ["generic", "wcp"]);
        const hub = boolParam("hub");
        // Two independent conditions, so the four combinations leave four
        // different lists and each path has to name both choices.
        const style = enumParam("style", ["plain", "wcpOnly", "hubbed"], {
            optionConditions: [
                shownWhen(["wcpOnly"], "vendor", "wcp"),
                shownWhen(["hubbed"], "hub", "true")
            ]
        });

        expect(labels([vendor, hub, style])).toEqual([
            "vendor",
            "hub",
            "generic › hub: Yes › style",
            "generic › hub: No › style",
            "wcp › hub: Yes › style",
            "wcp › hub: No › style"
        ]);
    });

    it("marks the first option left as the default when the declared one is hidden", () => {
        // `enumParam` defaults to its first option, which only generic offers.
        const size = enumParam("size", ["s1", "s2", "s3"], {
            optionConditions: [
                shownWhen(["s1"], "vendor", "generic"),
                shownWhen(["s2", "s3"], "vendor", "wcp")
            ]
        });

        const [, generic, wcp] = toParameterInstances([vendor, size]);

        expect(generic.implicitDefaultId).toBeUndefined();
        expect(wcp.implicitDefaultId).toBe("s2");
    });

    it("reports a parameter whole rather than enumerate past the cap", () => {
        const many = enumParam(
            "vendor",
            Array.from({ length: 300 }, (_, i) => `v${i}`)
        );
        const size = enumParam("size", ["s1", "s2"], {
            optionConditions: [shownWhen(["s1"], "vendor", "v0")]
        });

        const instances = toParameterInstances([many, size]);

        expect(instances).toHaveLength(2);
        expect(instances[1].path).toEqual([]);
        expect(instances[1].options).toHaveLength(2);
    });

    it("reports a parameter whole when its condition names a stale parameter", () => {
        // A RANGE condition on something that is no longer an enum throws; the
        // report has to survive it.
        const stale: ConfigurationParameter = {
            ...quantityParam("length"),
            condition: {
                type: VisibilityType.RANGE,
                id: "gone",
                start: "a",
                end: "b"
            }
        };
        expect(labels([quantityParam("gone"), stale])).toEqual([
            "gone",
            "length"
        ]);
    });
});
