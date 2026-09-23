import { describe, expect, it } from "vitest";
import { isDerivationVariable, parameterRole, ParameterRole } from "./roles";
import {
    enumParam,
    stringParam
} from "../../../__test_utils__/configuration-fixtures";

const named = (name: string) => ({ ...enumParam("p", ["x", "y"]), name });

describe("parameterRole", () => {
    it.each([
        ["Color", ParameterRole.COLOR],
        ["Part colour", ParameterRole.COLOR],
        ["Tessellation Quality", ParameterRole.TESSELLATION],
        ["Tesselation quality", ParameterRole.TESSELLATION]
    ])("recognizes %s", (name, role) => {
        expect(parameterRole(named(name))).toBe(role);
    });

    it.each(["Length", "Bearing", "Gear Ratio", "Colorway"])(
        "gives an ordinary parameter named %s no role",
        (name) => {
            expect(parameterRole(named(name))).toBeUndefined();
        }
    );

    it("recognizes a color channel beside its two siblings", () => {
        const channels = ["R", "G", "B"].map(named);
        for (const channel of channels) {
            expect(parameterRole(channel, channels)).toBe(
                ParameterRole.COLOR_CHANNEL
            );
        }
    });

    // A lone "B" is as likely a size as a blue.
    it("gives a single letter with no channel siblings no role", () => {
        const lone = named("B");
        expect(parameterRole(lone, [named("A"), lone])).toBeUndefined();
    });
});

describe("derivation variables", () => {
    it("recognizes a text parameter named for derivation", () => {
        const parameter = { ...stringParam("d"), name: "Derivation Variable" };
        expect(parameterRole(parameter)).toBe(
            ParameterRole.DERIVATION_VARIABLE
        );
        expect(isDerivationVariable(parameter)).toBe(true);
    });

    // Only a text one can take the unique value the app fills in, so one of
    // another type is an ordinary parameter: indexed and editable as usual.
    it("gives one of another type no role", () => {
        const parameter = named("Derivation Variable");
        expect(parameterRole(parameter)).toBeUndefined();
        expect(isDerivationVariable(parameter)).toBe(false);
    });
});
