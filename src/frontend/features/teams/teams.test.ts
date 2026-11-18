import { describe, expect, it } from "vitest";
import {
    ParameterRole,
    ParameterType,
    type ConfigurationParameter,
    type QuantityParameter
} from "@backend/features/configurations/contract";
import { QuantityType, Unit } from "@backend/features/configurations/enums";
import { Vendor } from "@backend/features/library/vendors";
import { findColorControl, readColor, writeColor } from "./color";
import { parseOnshapeTeamId } from "./onshape-team";
import { breakTiesByVendor, orderVendors, vendorRank } from "./vendor-ranking";

function channel(name: string, max: number): QuantityParameter {
    return {
        id: name,
        name,
        default: "0",
        type: ParameterType.QUANTITY,
        quantityType: QuantityType.INTEGER,
        defaultValue: 0,
        min: 0,
        max,
        unit: Unit.UNITLESS,
        role: ParameterRole.COLOR_CHANNEL
    };
}

describe("the color control", () => {
    it("stands in for three channels, red first whatever their order", () => {
        const parameters: ConfigurationParameter[] = [
            channel("Blue", 255),
            channel("Red", 255),
            channel("Green", 255)
        ];
        const control = findColorControl(parameters);
        expect(control?.kind).toBe("channels");
        if (control?.kind !== "channels") return;
        expect(control.channels.map((each) => each.name)).toEqual([
            "Red",
            "Green",
            "Blue"
        ]);

        const selection = writeColor(
            control,
            { Red: "0", Green: "0", Blue: "0" },
            "#ff8000"
        );
        expect(selection).toEqual({ Red: "255", Green: "128", Blue: "0" });
        expect(readColor(control, selection)).toBe("#ff8000");
    });

    it("scales channels that run to 1", () => {
        const control = findColorControl([
            channel("r", 1),
            channel("g", 1),
            channel("b", 1)
        ]);
        if (control?.kind !== "channels") throw new Error("no control");
        const selection = writeColor(control, {}, "#ffffff");
        expect(selection).toEqual({ r: "1", g: "1", b: "1" });
        expect(readColor(control, selection)).toBe("#ffffff");
    });

    it("writes a text color as hex", () => {
        const control = findColorControl([
            {
                id: "color",
                name: "Color",
                default: "",
                type: ParameterType.STRING,
                role: ParameterRole.COLOR
            }
        ]);
        if (!control) throw new Error("no control");
        expect(writeColor(control, {}, "#00FF00")).toEqual({
            color: "#00ff00"
        });
        expect(readColor(control, { color: "teal" })).toBeUndefined();
    });

    it("leaves a part without a color, or with two channels, alone", () => {
        expect(
            findColorControl([channel("Red", 255), channel("Green", 255)])
        ).toBeUndefined();
    });
});

describe("vendor ranking", () => {
    const ranking = [Vendor.WCP, Vendor.REV];

    it("ranks a part by its best vendor, and an unranked one last", () => {
        expect(vendorRank([Vendor.VEX, Vendor.REV], ranking)).toBe(1);
        expect(vendorRank([Vendor.VEX], ranking)).toBe(2);
    });

    it("lists ranked vendors first, keeping the rest in order", () => {
        expect(
            orderVendors(
                [Vendor.AM, Vendor.REV, Vendor.VEX, Vendor.WCP],
                ranking
            )
        ).toEqual([Vendor.WCP, Vendor.REV, Vendor.AM, Vendor.VEX]);
    });

    it("reorders only ties", () => {
        const items = [
            { score: 3, vendors: [Vendor.VEX] },
            { score: 2, vendors: [Vendor.VEX] },
            { score: 2, vendors: [Vendor.WCP] },
            { score: 1, vendors: [Vendor.WCP] }
        ];
        const sorted = breakTiesByVendor(
            items,
            (item) => item.vendors,
            (a, b) => a.score === b.score,
            ranking
        );
        expect(sorted.map((item) => [item.score, item.vendors[0]])).toEqual([
            [3, Vendor.VEX],
            [2, Vendor.WCP],
            [2, Vendor.VEX],
            [1, Vendor.WCP]
        ]);
    });
});

describe("parseOnshapeTeamId", () => {
    it("reads the id from a team's url or as pasted", () => {
        const id = "5eace32713a966103efd2a9c";
        expect(parseOnshapeTeamId(`https://cad.onshape.com/team/${id}`)).toBe(
            id
        );
        expect(parseOnshapeTeamId(id.toUpperCase())).toBe(id);
        expect(parseOnshapeTeamId("not a team")).toBeUndefined();
    });
});
