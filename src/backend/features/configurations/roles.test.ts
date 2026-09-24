import { describe, expect, it } from "vitest";
import { isDerivationVariable, withRoles } from "./roles";
import { type ConfigurationParameter, ParameterRole } from "./contract";
import {
    enumParam,
    stringParam
} from "../../../__test_utils__/configuration-fixtures";

const named = (name: string): ConfigurationParameter => ({
    ...enumParam(name, ["x", "y"]),
    name
});

/** The role each of `parameters` is recognized in, alongside the rest. */
const rolesOf = (...parameters: ConfigurationParameter[]) =>
    withRoles(parameters).map((parameter) => parameter.role);

describe("recognizing roles", () => {
    it.each([
        ["Color", ParameterRole.COLOR],
        ["Part colour", ParameterRole.COLOR],
        ["Tessellation Quality", ParameterRole.TESSELLATION],
        ["Tesselation quality", ParameterRole.TESSELLATION]
    ])("recognizes %s", (name, role) => {
        expect(rolesOf(named(name))).toEqual([role]);
    });

    it.each(["Length", "Bearing", "Gear Ratio", "Colorway"])(
        "gives an ordinary parameter named %s no role",
        (name) => {
            expect(rolesOf(named(name))).toEqual([undefined]);
        }
    );

    it("recognizes a color channel beside its two siblings", () => {
        expect(rolesOf(named("R"), named("G"), named("B"))).toEqual([
            ParameterRole.COLOR_CHANNEL,
            ParameterRole.COLOR_CHANNEL,
            ParameterRole.COLOR_CHANNEL
        ]);
    });

    // A lone "B" is as likely a size as a blue.
    it("gives a single letter with no channel siblings no role", () => {
        expect(rolesOf(named("A"), named("B"))).toEqual([undefined, undefined]);
    });
});

describe("derivation variables", () => {
    it("recognizes a text parameter named for derivation", () => {
        const [parameter] = withRoles([
            { ...stringParam("d"), name: "Derivation Variable" }
        ]);
        expect(parameter.role).toBe(ParameterRole.DERIVATION_VARIABLE);
        expect(isDerivationVariable(parameter)).toBe(true);
    });

    // Only a text one can take the unique value the app fills in, so one of
    // another type is an ordinary parameter: indexed and editable as usual.
    it("gives one of another type no role", () => {
        const [parameter] = withRoles([named("Derivation Variable")]);
        expect(parameter.role).toBeUndefined();
        expect(isDerivationVariable(parameter)).toBe(false);
    });
});
